const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  win: (a) => ipcRenderer.send('win', a),
  openMods: () => ipcRenderer.send('mods'),
  fullscreen: (v) => ipcRenderer.send('fs', v),
  pickFile: () => ipcRenderer.invoke('pick'),
  launch: (o) => ipcRenderer.invoke('launch', o),
  on: (ch, fn) => ipcRenderer.on(ch, (_, d) => fn(d)),
});
