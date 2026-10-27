const { contextBridge, ipcRenderer: r } = require('electron');
const ch = ['yt', 'ytm', 'sc', 'au', 'url', 'stream', 'sp', 'lyr', 'files', 'top', 'tray', 'shelf', 'sptest', 'ext', 'win'];
contextBridge.exposeInMainWorld('api', {
  ...Object.fromEntries(ch.map(c => [c, a => r.invoke(c, a)])),
  session: r.sendSync('sess:get'),                       // perfil ativo (ou null) — lido na hora, antes da página rodar
  sessLogin: a => r.invoke('sess:login', a), sessSave: a => r.invoke('sess:save', a), sessLogout: () => r.invoke('sess:logout'),
  sessList: () => r.invoke('sess:list'), sessDir: () => r.invoke('sess:dir'),
  onCmd: f => r.on('cmd', (_, c) => f(c)), onMax: f => r.on('max', (_, m) => f(m))
});
