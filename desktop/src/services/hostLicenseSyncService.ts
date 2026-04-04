import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '../utils/runtime';

/**
 * Mirrors Firestore `multiUserLan` into local SQLite so the Tauri LAN host can start.
 * Clears the flag when `false` (e.g. after sign-out or validation failure).
 */
export async function syncHostMultiUserLanFromCloud(unlocked: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke('set_multi_user_lan_unlock', { unlocked });
  } catch (e) {
    console.warn('syncHostMultiUserLanFromCloud:', e);
  }
}
