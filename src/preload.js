const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('frog', {
  getLang: () => ipcRenderer.invoke('getLang'),
  setLang: (c, a, b) => ipcRenderer.invoke('setLang', c, a, b),
  version: () => ipcRenderer.invoke('version'),
  doc: n => ipcRenderer.invoke('doc', n),
  pick: () => ipcRenderer.invoke('pick'),
  apply: (d, b) => ipcRenderer.invoke('apply', d, b),
  reset: d => ipcRenderer.invoke('reset', d),
  pathOf: f => webUtils.getPathForFile(f),
  onOpen: cb => ipcRenderer.on('open', (_, p) => cb(p))
});
