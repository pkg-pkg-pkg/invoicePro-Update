// src/types/electron.d.ts
export interface CompanyProfileRow {
  id?: number;
  company_code: string;
  company_name?: string;
  business_type?: string;
  owner_name?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  website?: string;
  financial_year?: string;
  logo_path?: string;
  signature_path?: string;
  stamp_path?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  upi_id?: string;
  upi_payee_name?: string;
  is_profile_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyProfileCompletionStatus {
  success?: boolean;
  profileCompleted?: boolean;
  companyExists?: boolean;
  companyCode?: string;
  companyName?: string;
  reason?: string;
  migrationStatus?: 'completed' | 'pending' | string;
  databasePath?: string;
  DATABASE_PATH?: string;
  COMPANY_EXISTS?: boolean;
  COMPANY_NAME?: string;
  COMPANY_CODE?: string;
  PROFILE_COMPLETED?: boolean;
  MIGRATION_STATUS?: string;
  REASON?: string;
  error?: string;
}

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
  companyLocalDataPersist?: (localData: Record<string, string>) => Promise<{
    success: boolean;
    error?: string;
    companyId?: string;
    userDataPath?: string;
    savePath?: string;
    readPath?: string;
    profilePath?: string;
    dbPath?: string;
    payloadKeyCount?: number;
    onDiskKeyCount?: number;
    setupCompleted?: boolean;
    profileComplete?: boolean;
    writeVerified?: boolean;
    commitOk?: boolean;
  }>;
  companyProfileGetActive?: () => Promise<{
    success: boolean;
    companyCode?: string;
    profile?: CompanyProfileRow | null;
    error?: string;
  }>;
  companyProfileUpsert?: (payload: Record<string, unknown>) => Promise<{
    success: boolean;
    companyCode?: string;
    profile?: CompanyProfileRow | null;
    error?: string;
  }>;
  companyProfileMarkCompleted?: (payload?: Record<string, unknown>) => Promise<{
    success: boolean;
    companyCode?: string;
    profile?: CompanyProfileRow | null;
    error?: string;
  }>;
  companyProfileCompletionStatus?: () => Promise<CompanyProfileCompletionStatus>;
  companyProfileRunMigration?: () => Promise<Record<string, unknown>>;
  profileDebugScan?: () => Promise<Record<string, unknown>>;
  profileDebugLog?: (payload: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  profileDebugLogPath?: () => Promise<{ path?: string; error?: string }>;
  dataStorageGetConfig?: () => Promise<{ success: boolean; config?: Record<string, unknown>; error?: string }>;
  dataStorageGetDiagnostics?: () => Promise<{ success: boolean; diagnostics?: Record<string, unknown>; error?: string }>;
  dataStorageScanLocations?: () => Promise<{ success: boolean; locations?: unknown[]; error?: string }>;
  dataStorageSetLocation?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  dataStorageCompleteFirstRun?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  dataStorageRestoreDetected?: (sourceRoot: string) => Promise<Record<string, unknown>>;
  dataStorageCheckWrite?: (targetDir: string) => Promise<{ ok: boolean; error?: string; path?: string }>;
  dataStorageOpenPath?: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  dataStorageShowInFolder?: (targetPath: string) => Promise<{ success: boolean; error?: string }>;

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
  mobileEntitlementsSync?: (payload: unknown) => Promise<boolean>;
  firebaseCallable?: (payload: {
    name: string;
    data?: unknown;
    idToken: string;
  }) => Promise<{ ok: boolean; result?: unknown; error?: string; code?: string }>;
  mobileSnapshotPublish?: (snapshot: unknown) => Promise<boolean>;
  onMobileDeviceBound?: (callback: (data: unknown) => void) => () => void;
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
  printToPDF?: (payload: { html: string; fileName?: string; landscape?: boolean; pageSize?: string }) => Promise<string | null>;
  printDirect?: (payload: { html: string; silent?: boolean }) => Promise<boolean>;
  openPrintPreview?: (payload: { html: string; pageSize?: string }) => Promise<boolean>;

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
  onNetworkOnline?: (callback: () => void) => () => void;

  getAppSystemInfo?: () => Promise<{
    appVersion?: string;
    applicationPath?: string;
    execPath?: string;
    userDataPath?: string;
    companyDataPath?: string;
    companyId?: string;
    companyName?: string;
    platform?: string;
    osLabel?: string;
    hostName?: string;
    totalMemoryGb?: number;
    arch?: string;
    error?: string;
  }>;

  getDeviceFingerprint?: () => Promise<{
    device_id: string;
    device_fingerprint?: string;
    device_name: string;
    os_info: string;
  }>;

  superAdminGetRuntime?: () => Promise<{
    success?: boolean;
    nodeVersion?: string;
    electronVersion?: string;
    uptimeSec?: number;
    ramMb?: number;
    osVersion?: string;
    platform?: string;
  }>;
  superAdminGetDbStatus?: () => Promise<{
    success?: boolean;
    dbPath?: string;
    sizeBytes?: number;
    integrity?: string;
    connected?: boolean;
    counts?: Record<string, number>;
    error?: string;
  }>;
  superAdminGetNetwork?: () => Promise<{
    success?: boolean;
    addresses?: Array<{ name: string; address: string }>;
    online?: boolean;
  }>;
  superAdminOpenPath?: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  superAdminOpenDbFolder?: () => Promise<{ success: boolean; path?: string; error?: string }>;
  superAdminOpenLogFolder?: () => Promise<{ success: boolean; path?: string; error?: string }>;
  superAdminRelaunch?: () => Promise<{ success: boolean }>;
  superAdminAppendLog?: (payload: { level: string; message: string; ts: number }) => Promise<{ success: boolean }>;
  superAdminGetLogPath?: () => Promise<{ success: boolean; path?: string; logsDir?: string }>;
  superAdminReadLogFile?: () => Promise<{ success: boolean; content?: string; error?: string }>;

  dialogPickFolder?: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>;
  dialogPickBackupFile?: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>;
  backupCreateManual?: (payload: { targetDir: string; allowSkipDatabase?: boolean }) => Promise<{
    success: boolean;
    fileName?: string;
    filePath?: string;
    location?: string;
    sizeBytes?: number;
    sizeLabel?: string;
    error?: string;
    partial?: boolean;
    databaseSkipped?: boolean;
    warning?: string;
    requiresDatabaseConfirmation?: boolean;
    dbSizeBytes?: number;
    dbSizeLabel?: string;
  }>;
  backupPreviewFile?: (payload: { filePath: string }) => Promise<{
    success: boolean;
    meta?: {
      version?: string;
      createdAt?: string;
      companyId?: string;
      companyName?: string;
      sections?: string[];
      hasDatabase?: boolean;
      databaseSkipped?: boolean;
      databaseSizeBytes?: number;
      restoreWarnings?: string[];
    };
    error?: string;
  }>;
  backupRestoreFromFile?: (payload: { filePath: string }) => Promise<{
    success: boolean;
    requiresReload?: boolean;
    restoredSections?: string[];
    restorePointId?: string;
    restorePointPath?: string;
    error?: string;
  }>;
  backupRollbackRestorePoint?: (payload: { restorePointId: string }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  shellShowItemInFolder?: (targetPath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
