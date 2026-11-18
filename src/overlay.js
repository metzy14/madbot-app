const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

function startOverlay(port, root, assets, getState) {
  const app = express();
  app.use(express.static(root));
  app.use('/fonts', express.static(`${assets}/fonts`));
  app.get('/logo.png', (_req, res) => res.sendFile(`${assets}/logo.png`));
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  function broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(data);
    }
  }

  function clients() {
    let count = 0;
    for (const client of wss.clients) if (client.readyState === 1 && !client.preview) count += 1;
    return count;
  }

  wss.on('connection', (socket, req) => {
    socket.preview = /[?&]preview=1/.test(req.url || '');
    socket.send(JSON.stringify(getState()));
  });

  server.on('error', (error) => console.error('Overlay server failed:', error.message));
  server.listen(port, '127.0.0.1');
  return { broadcast, clients };
}

module.exports = { startOverlay };
