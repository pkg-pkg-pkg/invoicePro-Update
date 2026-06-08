import { isElectronRuntime } from '../utils/runtime';

export type DataLocationType = 'appdata' | 'custom' | 'install';

export type DataStorageConfig = {
  version: number;
  dataLocationType: DataLocationType;
  dataRoot: string;
  databasePath: string;
  backupPath: string;
  documentsPath: string;
  exportsPath: string;
  settingsPath: string;
  companiesRoot: string;
  firstRunCompleted: boolean;
  profileCompleted: boolean;
  companyName: string;
  chosenAt?: string;
  bootstrapDir?: string;
  configPath?: string;
  installDataRoot?: string;
};

export type DataStorageDiagnostics = {
  dataLocationType: DataLocationType;
  dataRoot: string;
  databasePath: string;
  backupPath: string;
  configPath?: string;
  bootstrapDir?: string;
  firstRunCompleted?: boolean;
  companyFound?: boolean;
  companyName?: string;
  profileCompleted?: boolean;
  profileCheckReason?: string;
  recordCount?: number;
  databaseSizeBytes?: number;
  readPath?: string;
};

export type DetectedDataLocation = {
  id: string;
  label: string;
  path: string;
  type: DataLocationType;
  hasData?: boolean;
  databasePath?: string;
  databaseSizeBytes?: number;
};

const api = () => (isElectronRuntime() ? window.electronAPI : undefined);

export async function getDataStorageConfig(): Promise<DataStorageConfig | null> {
  if (!api()?.dataStorageGetConfig) return null;
  const res = await api()!.dataStorageGetConfig!();
  if (!res?.success) return null;
  return res.config as DataStorageConfig;
}

export async function getDataStorageDiagnostics(): Promise<DataStorageDiagnostics | null> {
  if (!api()?.dataStorageGetDiagnostics) return null;
  const res = await api()!.dataStorageGetDiagnostics!();
  if (!res?.success) return null;
  return res.diagnostics as DataStorageDiagnostics;
}

export async function scanDetectedDataLocations(): Promise<DetectedDataLocation[]> {
  if (!api()?.dataStorageScanLocations) return [];
  const res = await api()!.dataStorageScanLocations!();
  return (res?.locations as DetectedDataLocation[]) || [];
}

export async function setDataStorageLocation(input: {
  dataLocationType: DataLocationType;
  customPath?: string;
  moveExisting?: boolean;
}): Promise<{ success: boolean; error?: string; config?: DataStorageConfig; fallbackApplied?: boolean }> {
  if (!api()?.dataStorageSetLocation) return { success: false, error: 'Not available' };
  return (await api()!.dataStorageSetLocation!(input)) as {
    success: boolean;
    error?: string;
    config?: DataStorageConfig;
    fallbackApplied?: boolean;
  };
}

export async function completeDataStorageFirstRun(input: {
  dataLocationType: DataLocationType;
  customPath?: string;
  moveExisting?: boolean;
}): Promise<{ success: boolean; error?: string; config?: DataStorageConfig }> {
  if (!api()?.dataStorageCompleteFirstRun) return { success: false, error: 'Not available' };
  return (await api()!.dataStorageCompleteFirstRun!(input)) as {
    success: boolean;
    error?: string;
    config?: DataStorageConfig;
  };
}

export async function restoreDetectedDataLocation(
  sourceRoot: string
): Promise<{ success: boolean; error?: string; config?: DataStorageConfig }> {
  if (!api()?.dataStorageRestoreDetected) return { success: false, error: 'Not available' };
  return (await api()!.dataStorageRestoreDetected!(sourceRoot)) as {
    success: boolean;
    error?: string;
    config?: DataStorageConfig;
  };
}

export async function checkDataFolderWritable(targetDir: string): Promise<{ ok: boolean; error?: string }> {
  if (!api()?.dataStorageCheckWrite) return { ok: false, error: 'Not available' };
  const res = await api()!.dataStorageCheckWrite!(targetDir);
  return { ok: Boolean(res?.ok), error: res?.error };
}

export async function openDataPath(targetPath: string): Promise<void> {
  if (api()?.dataStorageOpenPath) await api()!.dataStorageOpenPath!(targetPath);
}

export async function showDataPathInFolder(targetPath: string): Promise<void> {
  if (api()?.dataStorageShowInFolder) await api()!.dataStorageShowInFolder!(targetPath);
}

export async function pickCustomDataFolder(): Promise<string | null> {
  if (!api()?.dialogPickFolder) return null;
  return api()!.dialogPickFolder!({ title: 'Select folder for company data' });
}
