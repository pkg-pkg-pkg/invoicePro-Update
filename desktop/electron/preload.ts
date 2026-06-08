import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  electronPlatform: process.platform,

  // Database operations
  getDb: () => ipcRenderer.invoke('get-db'),

  // Key-value storage (SQLite-backed)
  storageRead: (key: string) => ipcRenderer.invoke('kv-read', key),
  storageWrite: (key: string, value: unknown) => ipcRenderer.invoke('kv-write', key, value),
  storageRemove: (key: string) => ipcRenderer.invoke('kv-remove', key),

  companiesEnsureInitialized: (localData: Record<string, string>) =>
    ipcRenderer.invoke('companies-ensure-initialized', localData),
  companiesList: () => ipcRenderer.invoke('companies-list'),
  companiesGetActive: () => ipcRenderer.invoke('companies-get-active'),
  companiesCreate: (payload: Record<string, unknown>) => ipcRenderer.invoke('companies-create', payload),
  companiesSwitch: (payload: { targetId: string; currentLocalData: Record<string, string> }) =>
    ipcRenderer.invoke('companies-switch', payload),
  companiesListEnriched: () => ipcRenderer.invoke('companies-list-enriched'),
  companiesSetDefault: (companyId: string) => ipcRenderer.invoke('companies-set-default', companyId),
  companiesDelete: (payload: { companyId: string; currentLocalData: Record<string, string> }) =>
    ipcRenderer.invoke('companies-delete', payload),
  companySettingsRead: () => ipcRenderer.invoke('company-settings-read'),
  companySettingsWrite: (partial: Record<string, unknown>) =>
    ipcRenderer.invoke('company-settings-write', partial),
  companyLocalDataPersist: (localData: Record<string, string>) =>
    ipcRenderer.invoke('company-local-data-persist', localData),
  companyProfileGetActive: () => ipcRenderer.invoke('company-profile-get-active'),
  companyProfileUpsert: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('company-profile-upsert', payload),
  companyProfileMarkCompleted: (payload?: Record<string, unknown>) =>
    ipcRenderer.invoke('company-profile-mark-completed', payload || {}),
  companyProfileCompletionStatus: () => ipcRenderer.invoke('company-profile-completion-status'),
  companyProfileRunMigration: () => ipcRenderer.invoke('company-profile-run-migration'),
  profileDebugScan: () => ipcRenderer.invoke('profile-debug-scan'),
  profileDebugLog: (payload: Record<string, unknown>) => ipcRenderer.invoke('profile-debug-log', payload),
  profileDebugLogPath: () => ipcRenderer.invoke('profile-debug-log-path'),
  dataStorageGetConfig: () => ipcRenderer.invoke('data-storage-get-config'),
  dataStorageGetDiagnostics: () => ipcRenderer.invoke('data-storage-get-diagnostics'),
  dataStorageScanLocations: () => ipcRenderer.invoke('data-storage-scan-locations'),
  dataStorageSetLocation: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('data-storage-set-location', payload),
  dataStorageCompleteFirstRun: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('data-storage-complete-first-run', payload),
  dataStorageRestoreDetected: (sourceRoot: string) =>
    ipcRenderer.invoke('data-storage-restore-detected', sourceRoot),
  dataStorageCheckWrite: (targetDir: string) => ipcRenderer.invoke('data-storage-check-write', targetDir),
  dataStorageOpenPath: (targetPath: string) => ipcRenderer.invoke('data-storage-open-path', targetPath),
  dataStorageShowInFolder: (targetPath: string) =>
    ipcRenderer.invoke('data-storage-show-in-folder', targetPath),

  sessionValidate: () => ipcRenderer.invoke('session-validate'),
  sessionCheck: () => ipcRenderer.invoke('session-check'),
  sessionLogin: (payload: Record<string, unknown>) => ipcRenderer.invoke('session-login', payload),
  sessionRegister: (payload: Record<string, unknown>) => ipcRenderer.invoke('session-register', payload),
  sessionLegacy: (payload: Record<string, unknown>) => ipcRenderer.invoke('session-legacy', payload),
  sessionLogout: () => ipcRenderer.invoke('session-logout'),
  sessionRefresh: (lastCompany?: string) => ipcRenderer.invoke('session-refresh', lastCompany),
  getCompanies: () => ipcRenderer.invoke('get-companies'),
  sessionTouch: (lastCompany?: string) => ipcRenderer.invoke('session-touch', lastCompany),
  sessionGetSettings: () => ipcRenderer.invoke('session-get-settings'),
  sessionSetSettings: (payload: Record<string, unknown>) => ipcRenderer.invoke('session-set-settings', payload),

  pincodeLookup: (pin: string) => ipcRenderer.invoke('pincode-lookup', pin),

  // Sync operations
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  mobileSyncStatus: () => ipcRenderer.invoke('mobile-sync-status'),
  mobileSyncRetry: () => ipcRenderer.invoke('mobile-sync-retry'),
  mobileSyncPublishChange: (change: unknown) => ipcRenderer.invoke('mobile-sync-publish-change', change),
  mobileEntitlementsSync: (payload: unknown) => ipcRenderer.invoke('mobile-entitlements-sync', payload),
  mobileSnapshotPublish: (snapshot: unknown) => ipcRenderer.invoke('mobile-snapshot-publish', snapshot),
  onMobileDeviceBound: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on('mobile-device-bound', handler);
    return () => ipcRenderer.removeListener('mobile-device-bound', handler);
  },
  onSyncUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('sync-update', (_, data) => callback(data));
  },
  onMobileSyncStatus: (callback: (data: any) => void) => {
    ipcRenderer.on('mobile-sync-status', (_, data) => callback(data));
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
  openPrintPreview: (payload: { html: string }) => ipcRenderer.invoke('print:open-preview', payload),

  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  whatsappCheckStatus: () => ipcRenderer.invoke('whatsapp-check-status'),
  whatsappOpenChat: (phone: string, message: string) =>
    ipcRenderer.invoke('whatsapp-open-chat', phone, message),
  getAppSystemInfo: () => ipcRenderer.invoke('app-system-info'),
  dialogPickFolder: (options?: { title?: string; defaultPath?: string }) =>
    ipcRenderer.invoke('dialog-pick-folder', options ?? {}),
  dialogPickBackupFile: (options?: { title?: string; defaultPath?: string }) =>
    ipcRenderer.invoke('dialog-pick-backup-file', options ?? {}),
  backupCreateManual: (payload: { targetDir: string }) =>
    ipcRenderer.invoke('backup-create-manual', payload),
  shellShowItemInFolder: (targetPath: string) =>
    ipcRenderer.invoke('shell-show-item-in-folder', targetPath),
  onWindowStateChanged: (callback: (maximized: boolean) => void) => {
    const fn = (_e: unknown, maxed: unknown) => callback(Boolean(maxed));
    ipcRenderer.on('window-state-changed', fn);
    return () => ipcRenderer.removeListener('window-state-changed', fn);
  },
});

