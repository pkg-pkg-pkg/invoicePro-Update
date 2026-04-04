import { invoke } from '@tauri-apps/api/core';

const DEVICE_ID_KEY = 'device_id';

/**
 * Must match Firebase `deviceKey()` in `functions/src/index.ts`:
 * SHA-256 of UTF-8 device id, hex-encoded, first 32 characters.
 */
export async function computeLicenseDeviceKey(deviceId: string): Promise<string> {
  const data = new TextEncoder().encode(String(deviceId ?? ''));
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 32);
}

export async function getDeviceId(): Promise<string> {
  try {
    const isTauriRuntime = () => {
      try {
        if ((window as any).__TAURI__ != null) return true;
        if ((window as any).__TAURI_INTERNALS__ != null) return true;
        if ((window as any).__TAURI_IPC__ != null) return true;
        if ((window as any).__TAURI_METADATA__ != null) return true;
        const p = window.location.protocol;
        return p === 'tauri:' || p === 'file:';
      } catch {
        return false;
      }
    };

    if (isTauriRuntime()) {
      const st: any = await invoke('get_license_state');
      if (st?.machineId) return String(st.machineId);
      if (st?.machine_id) return String(st.machine_id);
    }
  } catch {
    // ignore
  }

  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
