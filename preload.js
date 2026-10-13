const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  win: (a) => ipcRenderer.send('win', a),
  fullscreen: (v) => ipcRenderer.send('fs', v),
  pickFile: () => ipcRenderer.invoke('pick'),
  openMods: () => ipcRenderer.send('mods'),
  listMods: () => ipcRenderer.invoke('mods:list'),
  msLogin: () => ipcRenderer.invoke('ms-login'),
  installMods: (o) => ipcRenderer.invoke('install-mods', o),
  launch: (o) => ipcRenderer.invoke('launch', o),
  on: (ch, fn) => ipcRenderer.on(ch, (_, d) => fn(d)),
});
