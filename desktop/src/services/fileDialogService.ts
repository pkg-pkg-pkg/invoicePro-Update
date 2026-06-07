import { isElectronRuntime } from '../utils/runtime';

type DialogOptions = {
  title?: string;
  defaultPath?: string;
};

export async function pickBackupFolder(options?: DialogOptions): Promise<string | null> {
  if (isElectronRuntime() && window.electronAPI?.dialogPickFolder) {
    return window.electronAPI.dialogPickFolder(options ?? {});
  }
  return null;
}

export async function pickBackupFile(options?: DialogOptions): Promise<string | null> {
  if (isElectronRuntime() && window.electronAPI?.dialogPickBackupFile) {
    return window.electronAPI.dialogPickBackupFile(options ?? {});
  }
  return null;
}

export async function revealPathInFolder(targetPath: string): Promise<boolean> {
  if (isElectronRuntime() && window.electronAPI?.shellShowItemInFolder) {
    return window.electronAPI.shellShowItemInFolder(targetPath);
  }
  return false;
}
