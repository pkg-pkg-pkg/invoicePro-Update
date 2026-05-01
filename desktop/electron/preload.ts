import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  electronPlatform: process.platform,

  // Database operations
  getDb: () => ipcRenderer.invoke('get-db'),

  // Key-value storage (SQLite-backed)
  storageRead: (key: string) => ipcRenderer.invoke('kv-read', key),
  storageWrite: (key: string, value: unknown) => ipcRenderer.invoke('kv-write', key, value),
  storageRemove: (key: string) => ipcRenderer.invoke('kv-remove', key),

  // Sync operations
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  onSyncUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('sync-update', (_, data) => callback(data));
  },

  // Update operations
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Update event listeners
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateNotAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-not-available', (_, info) => callback(info));
  },
  onDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('download-progress', (_, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  onUpdateError: (callback: (error: any) => void) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },

  // Remove all listeners (cleanup)
  removeAllListeners: (event: string) => {
    ipcRenderer.removeAllListeners(event);
  },
  printToPDF: (payload: { html: string; fileName?: string; landscape?: boolean }) =>
    ipcRenderer.invoke('print:pdf', payload),
  printDirect: (payload: { html: string; silent?: boolean }) =>
    ipcRenderer.invoke('print:direct', payload),

  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback: (maximized: boolean) => void) => {
    const fn = (_e: unknown, maxed: unknown) => callback(Boolean(maxed));
    ipcRenderer.on('window-state-changed', fn);
    return () => ipcRenderer.removeListener('window-state-changed', fn);
  },
});

