const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('frog', {
  version: () => ipcRenderer.invoke('version'),
  doc: n => ipcRenderer.invoke('doc', n),
  pick: () => ipcRenderer.invoke('pick'),
  apply: (d, b) => ipcRenderer.invoke('apply', d, b),
  reset: d => ipcRenderer.invoke('reset', d),
  pathOf: f => webUtils.getPathForFile(f),
  onOpen: cb => ipcRenderer.on('open', (_, p) => cb(p))
});
