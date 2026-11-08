const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

function startOverlay(port, root, getSettings) {
  const app = express();
  app.use(express.static(root));
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  function broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(data);
    }
  }

  wss.on('connection', (socket) => {
    const settings = getSettings();
    socket.send(JSON.stringify({
      type: 'state',
      goal: settings.goal,
      chat: (settings.chat || []).slice(-30),
      events: (settings.events || []).slice(0, 8),
      channel: settings.kickChannel,
    }));
  });

  server.listen(port, '127.0.0.1');
  return { broadcast };
}

module.exports = { startOverlay };
