const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printSilent: (htmlContent, options) => ipcRenderer.invoke('print-silent', htmlContent, options),
  isElectron: true
});