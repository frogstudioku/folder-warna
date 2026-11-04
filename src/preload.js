const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('frog', {
  pick: () => ipcRenderer.invoke('pick'),
  apply: (d, b) => ipcRenderer.invoke('apply', d, b),
  reset: d => ipcRenderer.invoke('reset', d),
  pathOf: f => webUtils.getPathForFile(f),
  onOpen: cb => ipcRenderer.on('open', (_, p) => cb(p))
});
