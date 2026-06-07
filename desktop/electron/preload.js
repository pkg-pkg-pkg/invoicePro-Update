const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** win32 / linux use frameless + custom title bar; darwin keeps native frame */
  electronPlatform: process.platform,

  getDb: () => ipcRenderer.invoke('get-db'),

  // Key-value storage backed by SQLite
  storageRead: (key) => ipcRenderer.invoke('kv-read', key),
  storageWrite: (key, value) => ipcRenderer.invoke('kv-write', key, value),
    storageRemove: (key) => ipcRenderer.invoke('kv-remove', key),
    companiesEnsureInitialized: (localData) => ipcRenderer.invoke('companies-ensure-initialized', localData),
    companiesList: () => ipcRenderer.invoke('companies-list'),
    companiesGetActive: () => ipcRenderer.invoke('companies-get-active'),
    companiesCreate: (payload) => ipcRenderer.invoke('companies-create', payload),
    companiesSwitch: (payload) => ipcRenderer.invoke('companies-switch', payload),
    companiesListEnriched: () => ipcRenderer.invoke('companies-list-enriched'),
    companiesSetDefault: (companyId) => ipcRenderer.invoke('companies-set-default', companyId),
    companiesDelete: (payload) => ipcRenderer.invoke('companies-delete', payload),
    companySettingsRead: () => ipcRenderer.invoke('company-settings-read'),
    companySettingsWrite: (partial) => ipcRenderer.invoke('company-settings-write', partial),
    companyLocalDataPersist: (localData) => ipcRenderer.invoke('company-local-data-persist', localData),
    sessionValidate: () => ipcRenderer.invoke('session-validate'),
    sessionCheck: () => ipcRenderer.invoke('session-check'),
    sessionLogin: (payload) => ipcRenderer.invoke('session-login', payload),
    sessionRegister: (payload) => ipcRenderer.invoke('session-register', payload),
    sessionLegacy: (payload) => ipcRenderer.invoke('session-legacy', payload),
    sessionLogout: () => ipcRenderer.invoke('session-logout'),
    sessionRefresh: (lastCompany) => ipcRenderer.invoke('session-refresh', lastCompany),
    getCompanies: () => ipcRenderer.invoke('get-companies'),
    sessionTouch: (lastCompany) => ipcRenderer.invoke('session-touch', lastCompany),
    sessionGetSettings: () => ipcRenderer.invoke('session-get-settings'),
    sessionSetSettings: (payload) => ipcRenderer.invoke('session-set-settings', payload),

  pincodeLookup: (pin) => ipcRenderer.invoke('pincode-lookup', pin),

  // Sync operations
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  mobileSyncStatus: () => ipcRenderer.invoke('mobile-sync-status'),
  mobileSyncRetry: () => ipcRenderer.invoke('mobile-sync-retry'),
  mobileSyncPublishChange: (change) => ipcRenderer.invoke('mobile-sync-publish-change', change),
  onSyncUpdate: (callback) => {
    ipcRenderer.on('sync-update', (_, data) => callback(data));
  },
  onMobileSyncStatus: (callback) => {
    ipcRenderer.on('mobile-sync-status', (_, data) => callback(data));
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
  openPrintPreview: (payload) => ipcRenderer.invoke('print:open-preview', payload),

  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  whatsappCheckStatus: () => ipcRenderer.invoke('whatsapp-check-status'),
  whatsappOpenChat: (phone, message) => ipcRenderer.invoke('whatsapp-open-chat', phone, message),
  getAppSystemInfo: () => ipcRenderer.invoke('app-system-info'),
  dialogPickFolder: (options) => ipcRenderer.invoke('dialog-pick-folder', options ?? {}),
  dialogPickBackupFile: (options) => ipcRenderer.invoke('dialog-pick-backup-file', options ?? {}),
  backupCreateManual: (payload) => ipcRenderer.invoke('backup-create-manual', payload),
  shellShowItemInFolder: (targetPath) => ipcRenderer.invoke('shell-show-item-in-folder', targetPath),
  onWindowStateChanged: (callback) => {
    const fn = (_e, maxed) => callback(Boolean(maxed));
    ipcRenderer.on('window-state-changed', fn);
    return () => ipcRenderer.removeListener('window-state-changed', fn);
  },
});
