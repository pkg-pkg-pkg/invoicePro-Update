// src/types/electron.d.ts
export interface ElectronAPI {
  /** `process.platform` from main; custom title bar only on win32/linux */
  electronPlatform?: string;

  // Database operations
  getDb: () => Promise<any>;

  // SQLite-backed key/value storage
  storageRead: <T = unknown>(key: string) => Promise<T | null>;
  storageWrite: (key: string, value: unknown) => Promise<boolean>;
  storageRemove: (key: string) => Promise<boolean>;

  // Sync operations
  syncStatus: () => Promise<any>;
  syncNow: () => Promise<any>;
  onSyncUpdate: (callback: (data: any) => void) => void;

  // Update operations
  checkForUpdates: () => Promise<{
    updateAvailable: boolean;
    currentVersion: string;
    newVersion?: string;
    releaseNotes?: string;
    releaseDate?: string;
  }>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => void;

  // Update event listeners
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateNotAvailable: (callback: (info: any) => void) => void;
  onDownloadProgress: (callback: (progress: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onUpdateError: (callback: (error: any) => void) => void;

  // Cleanup
  removeAllListeners: (event: string) => void;

  /** Frameless window (Windows/Linux) */
  windowMinimize?: () => Promise<void>;
  windowToggleMaximize?: () => Promise<void>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
  onWindowStateChanged?: (callback: (maximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
