/**
 * Persistent sync settings + queue (Electron kv_store via IPC, localStorage fallback).
 * Keys match the middleware sync contract.
 */

import { isElectronRuntime } from '../../utils/runtime';

export const SYNC_STORE_KEYS = {
  syncEnabled: 'syncEnabled',
  middlewareUrl: 'middlewareUrl',
  userUUID: 'userUUID',
  deltaQueue: 'deltaQueue',
  lastSyncedAt: 'lastSyncedAt',
  syncJwtToken: 'syncJwtToken',
} as const;

async function readKey<T>(key: string): Promise<T | null> {
  try {
    let value: T | null = null;
    if (isElectronRuntime() && window.electronAPI?.storageRead) {
      value = (await window.electronAPI.storageRead<T>(key)) ?? null;
    } else {
      const raw = localStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as T;
    }
    const preview =
      key === SYNC_STORE_KEYS.syncJwtToken && typeof value === 'string'
        ? `${value.slice(0, 20)}…`
        : value;
    console.log('[middleware-sync] store read', key, preview);
    return value;
  } catch {
    console.warn('[middleware-sync] store read failed', key);
    return null;
  }
}

async function writeKey<T>(key: string, value: T): Promise<void> {
  if (isElectronRuntime() && window.electronAPI?.storageWrite) {
    await window.electronAPI.storageWrite(key, value);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export const syncElectronStore = {
  read: readKey,
  write: writeKey,

  async getSyncEnabled(): Promise<boolean> {
    return (await readKey<boolean>(SYNC_STORE_KEYS.syncEnabled)) ?? false;
  },

  async setSyncEnabled(enabled: boolean): Promise<void> {
    await writeKey(SYNC_STORE_KEYS.syncEnabled, enabled);
  },

  async getMiddlewareUrl(): Promise<string> {
    return (await readKey<string>(SYNC_STORE_KEYS.middlewareUrl)) ?? '';
  },

  async setMiddlewareUrl(url: string): Promise<void> {
    await writeKey(SYNC_STORE_KEYS.middlewareUrl, url);
  },

  async getUserUUID(): Promise<string> {
    return (await readKey<string>(SYNC_STORE_KEYS.userUUID)) ?? '';
  },

  async setUserUUID(uuid: string): Promise<void> {
    await writeKey(SYNC_STORE_KEYS.userUUID, uuid);
  },

  async getJwtToken(): Promise<string> {
    return (
      (await readKey<string>(SYNC_STORE_KEYS.syncJwtToken)) ??
      (await readKey<string>('invoicepro_middleware_jwt')) ??
      ''
    );
  },

  async setJwtToken(token: string): Promise<void> {
    await writeKey(SYNC_STORE_KEYS.syncJwtToken, token);
  },

  async getLastSyncedAt(): Promise<string | null> {
    return await readKey<string>(SYNC_STORE_KEYS.lastSyncedAt);
  },

  async setLastSyncedAt(iso: string): Promise<void> {
    await writeKey(SYNC_STORE_KEYS.lastSyncedAt, iso);
  },

  async getDeltaQueue<T>(): Promise<T[]> {
    return (await readKey<T[]>(SYNC_STORE_KEYS.deltaQueue)) ?? [];
  },

  async setDeltaQueue<T>(queue: T[]): Promise<void> {
    await writeKey(SYNC_STORE_KEYS.deltaQueue, queue);
  },
};
