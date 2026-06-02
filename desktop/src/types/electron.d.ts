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

  companiesEnsureInitialized?: (localData: Record<string, string>) => Promise<{
    migrated?: boolean;
    activeId?: string;
    companies?: unknown[];
  }>;
  companiesList?: () => Promise<{ companies: Array<{ id: string; name: string; gstin?: string; created: string }>; activeId: string }>;
  companiesGetActive?: () => Promise<{
    company: { id: string; name: string };
    profile: Record<string, unknown> | null;
    localData: Record<string, string>;
  }>;
  companiesCreate?: (payload: Record<string, unknown>) => Promise<unknown>;
  companiesSwitch?: (payload: { targetId: string; currentLocalData: Record<string, string> }) => Promise<unknown>;
  companiesListEnriched?: () => Promise<{
    companies: Array<{
      id: string;
      name: string;
      gstin?: string;
      fy?: string;
      created: string;
      is_default?: boolean;
      folderOk?: boolean;
    }>;
    activeId: string;
    defaultCompany: string;
  }>;
  companiesSetDefault?: (companyId: string) => Promise<{ defaultCompany: string }>;
  companiesDelete?: (payload: {
    companyId: string;
    currentLocalData: Record<string, string>;
  }) => Promise<{
    deletedId: string;
    activeId: string;
    switched: boolean;
    company?: { id: string; name: string };
    profile?: Record<string, unknown> | null;
    localData?: Record<string, string>;
  }>;
  companySettingsRead?: () => Promise<{
    success: boolean;
    settings?: Record<string, unknown>;
    error?: string;
  }>;
  companySettingsWrite?: (partial: Record<string, unknown>) => Promise<{
    success: boolean;
    settings?: Record<string, unknown>;
    error?: string;
    path?: string;
  }>;
  companyLocalDataPersist?: (localData: Record<string, string>) => Promise<{ success: boolean; error?: string }>;

  sessionValidate?: () => Promise<{
    valid: boolean;
    reason?: string;
    sessionToken?: string;
    user?: { id: string; username: string; email: string; fullName: string; role: string };
  }>;
  sessionLogin?: (payload: Record<string, unknown>) => Promise<{
    success: boolean;
    reason?: string;
    sessionToken?: string;
    user?: { id: string; username: string; email: string; fullName: string; role: string };
  }>;
  sessionRegister?: (payload: Record<string, unknown>) => Promise<{
    sessionToken?: string;
    user?: { id: string; username: string; email: string; fullName: string; role: string };
  }>;
  sessionLegacy?: (payload: Record<string, unknown>) => Promise<{
    valid: boolean;
    sessionToken?: string;
    user?: { id: string; username: string; email: string; fullName: string; role: string };
  }>;
  sessionLogout?: () => Promise<{ success: boolean }>;
  sessionCheck?: () => Promise<{ valid: boolean; reason?: string }>;
  sessionRefresh?: (lastCompany?: string) => Promise<{ valid: boolean; reason?: string }>;
  getCompanies?: () => Promise<{ companies: unknown[]; activeId: string; error?: string }>;
  sessionTouch?: (lastCompany?: string) => Promise<{ success: boolean; expired?: boolean }>;
  sessionGetSettings?: () => Promise<{ sessionDaysDefault: number; sessionDaysRemember: number }>;
  sessionSetSettings?: (payload: Record<string, unknown>) => Promise<{
    sessionDaysDefault: number;
    sessionDaysRemember: number;
  }>;

  /** India Post pincode API (main process fetch). */
  pincodeLookup?: (pin: string) => Promise<unknown>;

  // Sync operations
  syncStatus: () => Promise<any>;
  syncNow: () => Promise<any>;
  mobileSyncStatus?: () => Promise<any>;
  mobileSyncRetry?: () => Promise<any>;
  mobileSyncPublishChange?: (change: unknown) => Promise<boolean>;
  onSyncUpdate: (callback: (data: any) => void) => void;
  onMobileSyncStatus?: (callback: (data: any) => void) => void;

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
  printToPDF?: (payload: { html: string; fileName?: string; landscape?: boolean }) => Promise<string | null>;
  printDirect?: (payload: { html: string; silent?: boolean }) => Promise<boolean>;
  openPrintPreview?: (payload: { html: string }) => Promise<boolean>;

  /** Frameless window (Windows/Linux) */
  windowMinimize?: () => Promise<void>;
  windowToggleMaximize?: () => Promise<void>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
  openExternalUrl?: (url: string) => Promise<boolean>;
  whatsappCheckStatus?: () => Promise<{
    ok: boolean;
    mode: 'desktop' | 'web' | 'none';
    status: string;
  }>;
  whatsappOpenChat?: (
    phone: string,
    message: string
  ) => Promise<{
    ok: boolean;
    mode: 'desktop' | 'web' | 'none';
    status: string;
    error?: string;
  }>;
  onWindowStateChanged?: (callback: (maximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
