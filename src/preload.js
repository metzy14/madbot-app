const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('madbot', {
  boot: () => ipcRenderer.invoke('boot'),
  save: (settings) => ipcRenderer.invoke('save', settings),
  testAlert: (kind, data) => ipcRenderer.invoke('test-alert', { kind, data }),
  pushChat: (line) => ipcRenderer.invoke('push-chat', line),
  openOverlay: (url) => ipcRenderer.invoke('open-overlay', url),
  scanLights: () => ipcRenderer.invoke('lights-scan'),
  testLights: () => ipcRenderer.invoke('lights-test'),
  testVoice: (text) => ipcRenderer.invoke('voice-test', text),
  onSpeak: (callback) => ipcRenderer.on('speak', (_event, payload) => callback(payload)),
});
