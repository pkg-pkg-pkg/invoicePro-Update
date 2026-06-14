const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pvePrintPreview', {
  print: () => ipcRenderer.invoke('print:preview-print'),
  close: () => ipcRenderer.invoke('print:preview-close'),
  setPageSize: (size) => ipcRenderer.invoke('print:preview-set-size', size),
});
