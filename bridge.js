const WebSocket = require('ws');
const net = require('net');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`Relay activo en puerto ${PORT}`);

wss.on('connection', (ws) => {
  let tcpSocket = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'AUTH_ICECAST') {
        const { host, port, mount, user, password } = data;
        
        tcpSocket = new net.Socket();
        tcpSocket.connect(Number(port) || 80, host, () => {
          const auth = Buffer.from(`${user}:${password}`).toString('base64');
          const cleanMount = mount.startsWith('/') ? mount : `/${mount}`;
          
          const header = `SOURCE ${cleanMount} ICE/1.0\r\n` +
                         `Authorization: Basic ${auth}\r\n` +
                         `User-Agent: BroadcasterApp/1.0\r\n` +
                         `Content-Type: audio/mpeg\r\n` +
                         `ice-name: Transmision Movil\r\n\r\n`;
          tcpSocket.write(header);
        });

        tcpSocket.on('data', (chunk) => {
          const response = chunk.toString();
          if (response.includes('200 OK')) {
            ws.send(JSON.stringify({ status: 'SUCCESS' }));
          } else if (response.includes('401')) {
            ws.send(JSON.stringify({ status: 'ERROR', code: 401, message: 'Usuario o contraseña no coinciden' }));
          } else if (response.includes('404')) {
            ws.send(JSON.stringify({ status: 'ERROR', code: 404, message: 'Mount point (anclaje) no encontrado' }));
          } else {
            ws.send(JSON.stringify({ status: 'ERROR', code: 500, message: 'Rechazado por Zeno Media' }));
          }
        });

        tcpSocket.on('error', (err) => {
          ws.send(JSON.stringify({ status: 'ERROR', code: 0, message: err.message }));
        });
      }
    } catch (e) {
      if (tcpSocket && !tcpSocket.destroyed && tcpSocket.writable) {
        tcpSocket.write(message);
      }
    }
  });

  ws.on('close', () => {
    if (tcpSocket) tcpSocket.destroy();
  });
});
