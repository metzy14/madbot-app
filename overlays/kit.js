// Shared helpers for MadBot overlays: socket with auto-reconnect, theme, escaping.
(function () {
  const root = document.documentElement;
  const Mad = {
    preview: /[?&]preview=1/.test(location.search),
    theme: {},
    esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    nameColor(name) {
      let hash = 0;
      for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      return `hsl(${hash % 360} 90% 70%)`;
    },
    applyTheme(theme) {
      Mad.theme = theme || {};
      if (theme.accent) root.style.setProperty('--accent', theme.accent);
      if (theme.accent2) root.style.setProperty('--accent2', theme.accent2);
      if (theme.chatSize) root.style.setProperty('--chat-size', `${theme.chatSize}px`);
    },
    connect(handler) {
      const open = () => {
        const socket = new WebSocket(`ws://${location.host}/${location.search}`);
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'state' && message.theme) Mad.applyTheme(message.theme);
          handler(message);
        };
        socket.onclose = () => setTimeout(open, 2000);
      };
      open();
    },
    // Small confetti/particle burst on a full-size canvas.
    burst(canvas, x, y, colors, count = 90) {
      const ctx = canvas.getContext('2d');
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      const parts = Array.from({ length: count }, () => {
        const a = Math.random() * Math.PI * 2;
        const v = 6 + Math.random() * 14;
        return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: 3 + Math.random() * 6, life: 1, spin: Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)], sq: Math.random() > 0.5 };
      });
      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = 0;
        parts.forEach((p) => {
          if (p.life <= 0) return;
          alive += 1;
          p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.vx *= 0.985; p.life -= 0.012; p.spin += 0.2;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.c;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin);
          if (p.sq) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
          else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        });
        if (alive) requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
      tick();
    },
    // Synth stinger so alerts have sound without shipping audio files.
    chime() {
      if (Mad.preview || Mad.theme.alertSound === false) return;
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const now = ac.currentTime;
        const master = ac.createGain();
        master.gain.value = 0.22;
        master.connect(ac.destination);
        [[523.25, 0], [659.25, 0.09], [783.99, 0.18], [1046.5, 0.27]].forEach(([f, t]) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          g.gain.setValueAtTime(0, now + t);
          g.gain.linearRampToValueAtTime(0.8, now + t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.6);
          o.connect(g); g.connect(master);
          o.start(now + t); o.stop(now + t + 0.7);
        });
        setTimeout(() => ac.close(), 1500);
      } catch (_) { /* no audio */ }
    },
  };
  window.Mad = Mad;
})();
