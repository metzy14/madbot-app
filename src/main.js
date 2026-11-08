const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startOverlay } = require('./overlay');
const { flashLights, scanLights } = require('./lights');
const { speak } = require('./voice');

const PORT = 4721;

const DEFAULTS = {
  kickChannel: 'maddogmetzy',
  discord: 'https://discord.gg/thedogkennel',
  goal: { label: 'Follower goal', current: 1400, target: 2000 },
  alerts: {
    follow: { enabled: true, title: '{name} followed', detail: 'Welcome to the kennel.', duration: 6000, color: '#53fc18' },
    sub: { enabled: true, title: '{name} subscribed', detail: 'Thank you for the sub.', duration: 7000, color: '#7cff4f' },
    raid: { enabled: true, title: '{name} raided', detail: '{viewers} viewers incoming.', duration: 8000, color: '#d6ff4a' },
    host: { enabled: true, title: '{name} hosted', detail: 'Go show them love.', duration: 6000, color: '#b6ff8a' },
    kick: { enabled: true, title: '{name} sent Kicks', detail: '{amount} Kicks', duration: 6000, color: '#53fc18' },
    tip: { enabled: true, title: '{name} tipped', detail: '{amount}', duration: 7000, color: '#ffe56a' },
  },
  commands: [
    { name: '!discord', reply: 'Join the Discord: {discord}' },
    { name: '!goal', reply: 'Follower goal: {current} / {target}' },
    { name: '!so', reply: 'Shoutout to {name}: https://kick.com/{name}' },
  ],
  events: [],
  chat: [],
  lights: {
    enabled: true,
    provider: 'hue',
    color: '#53fc18',
    hue: { bridge: '', user: '', lightIds: '' },
    govee: { apiKey: '', device: '', sku: '' },
  },
  voice: {
    enabled: true,
    provider: 'system',
    systemVoice: '',
    rate: 1,
    apiKey: '',
    voiceId: '',
  },
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    saved = {};
  }
  return {
    ...DEFAULTS,
    ...saved,
    goal: { ...DEFAULTS.goal, ...(saved.goal || {}) },
    alerts: { ...DEFAULTS.alerts, ...(saved.alerts || {}) },
    lights: {
      ...DEFAULTS.lights,
      ...(saved.lights || {}),
      hue: { ...DEFAULTS.lights.hue, ...(saved.lights?.hue || {}) },
      govee: { ...DEFAULTS.lights.govee, ...(saved.lights?.govee || {}) },
    },
    voice: { ...DEFAULTS.voice, ...(saved.voice || {}) },
    commands: saved.commands || DEFAULTS.commands,
    events: saved.events || [],
    chat: saved.chat || [],
  };
}

function saveSettings(next) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}

let settings = null;
let overlay = null;
let mainWindow = null;
const queue = [];
let playing = false;

function fill(template, data) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (data[key] == null ? '' : String(data[key])));
}

function broadcastState() {
  overlay.broadcast({
    type: 'state',
    goal: settings.goal,
    chat: settings.chat.slice(-30),
    events: settings.events.slice(0, 8),
    channel: settings.kickChannel,
  });
}

function pump() {
  if (playing || !queue.length) return;
  playing = true;
  const item = queue.shift();
  overlay.broadcast({ type: 'alert', alert: item });
  speak(mainWindow, settings, `${item.title}. ${item.detail}`);
  flashLights(settings).catch((error) => console.error('Lights failed:', error));
  setTimeout(() => {
    playing = false;
    pump();
  }, item.duration || 6000);
}

function pushAlert(kind, data) {
  const template = settings.alerts[kind];
  if (!template || !template.enabled) return { ok: false, error: 'That alert is off.' };
  const payload = {
    kind,
    title: fill(template.title, data),
    detail: fill(template.detail, data),
    duration: template.duration,
    color: template.color,
  };
  queue.push(payload);
  settings.events.unshift({ text: payload.title, at: Date.now() });
  settings.events = settings.events.slice(0, 40);
  saveSettings(settings);
  broadcastState();
  pump();
  return { ok: true };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#070907',
    title: 'MadBot',
    icon: path.join(__dirname, '..', 'assets', 'logo.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow = win;
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('gg.thedogkennel.madbot');
  settings = loadSettings();
  overlay = startOverlay(PORT, path.join(__dirname, '..', 'overlays'), () => settings);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('boot', () => ({
  settings,
  port: PORT,
  urls: {
    alert: `http://127.0.0.1:${PORT}/alert.html`,
    chat: `http://127.0.0.1:${PORT}/chat.html`,
    goal: `http://127.0.0.1:${PORT}/goal.html`,
    events: `http://127.0.0.1:${PORT}/events.html`,
  },
}));

ipcMain.handle('save', (_event, next) => {
  settings = { ...settings, ...next };
  saveSettings(settings);
  broadcastState();
  return settings;
});

ipcMain.handle('test-alert', (_event, payload) => pushAlert(payload.kind, payload.data || { name: 'MaddogMetzy', viewers: 42, amount: '100' }));

ipcMain.handle('push-chat', (_event, line) => {
  const text = String(line || '').trim();
  if (!text) return settings.chat;
  settings.chat.push({ name: 'you', text, at: Date.now() });
  settings.chat = settings.chat.slice(-80);
  const command = settings.commands.find((item) => text.toLowerCase().startsWith(item.name.toLowerCase()));
  if (command) {
    const name = text.split(/\s+/).slice(1).join(' ') || 'someone';
    const reply = fill(command.reply, {
      name,
      discord: settings.discord,
      current: settings.goal.current,
      target: settings.goal.target,
    });
    settings.chat.push({ name: 'MadBot', text: reply, at: Date.now() });
    speak(mainWindow, settings, reply);
  }
  saveSettings(settings);
  broadcastState();
  return settings.chat;
});

ipcMain.handle('open-overlay', (_event, url) => shell.openExternal(url));

ipcMain.handle('lights-scan', async () => {
  const result = await scanLights(settings);
  saveSettings(settings);
  return { ...result, settings };
});

ipcMain.handle('lights-test', async () => flashLights(settings));

ipcMain.handle('voice-test', async (_event, text) => speak(mainWindow, settings, text || 'MadBot is live. Lights and voice are on.'));
