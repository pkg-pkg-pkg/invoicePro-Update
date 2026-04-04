import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getDb: () => ipcRenderer.invoke('get-db'),
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  onSyncUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('sync-update', (_, data) => callback(data));
  },
});

