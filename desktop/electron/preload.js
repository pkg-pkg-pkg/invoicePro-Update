const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** win32 / linux use frameless + custom title bar; darwin keeps native frame */
  electronPlatform: process.platform,

  getDb: () => ipcRenderer.invoke('get-db'),

  // Key-value storage backed by SQLite
  storageRead: (key) => ipcRenderer.invoke('kv-read', key),
  storageWrite: (key, value) => ipcRenderer.invoke('kv-write', key, value),
  storageRemove: (key) => ipcRenderer.invoke('kv-remove', key),

  // Sync operations
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  onSyncUpdate: (callback) => {
    ipcRenderer.on('sync-update', (_, data) => callback(data));
  },

  // Update operations
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Update event listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (_, info) => callback(info));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },

  removeAllListeners: (event) => {
    ipcRenderer.removeAllListeners(event);
  },
  printToPDF: (payload) => ipcRenderer.invoke('print:pdf', payload),
  printDirect: (payload) => ipcRenderer.invoke('print:direct', payload),

  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback) => {
    const fn = (_e, maxed) => callback(Boolean(maxed));
    ipcRenderer.on('window-state-changed', fn);
    return () => ipcRenderer.removeListener('window-state-changed', fn);
  },
});
