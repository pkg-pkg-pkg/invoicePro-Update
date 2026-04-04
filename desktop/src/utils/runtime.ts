/** True when running inside the Tauri shell (not Electron, not plain browser). */
export function isTauriRuntime(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as Record<string, unknown>;
    if (w.__TAURI__ != null) return true;
    if (w.__TAURI_INTERNALS__ != null) return true;
    if (w.__TAURI_IPC__ != null) return true;
    if (w.__TAURI_METADATA__ != null) return true;
    return false;
  } catch {
    return false;
  }
}

export function isElectronRuntime(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return (window as unknown as { electronAPI?: unknown }).electronAPI != null;
  } catch {
    return false;
  }
}
