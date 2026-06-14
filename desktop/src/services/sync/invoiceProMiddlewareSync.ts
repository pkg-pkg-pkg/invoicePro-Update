/**
 * Invoice Pro Cloud Middleware Sync (System 2)
 * Public API — internals split across sync* modules.
 */

import { generateId } from '../../utils/id';
import { storageDriver } from '../storage/storageDriver';
import { enqueueDelta } from './syncDeltaCapture';
import { drainQueue, initDrainListeners, isDrainInProgress, schedulePostLoginDrain } from './syncQueueDrain';
import { syncElectronStore } from './syncElectronStore';
import type { CaptureDeltaParams, SyncStatusSnapshot } from './syncDeltaTypes';

const LEGACY_CONFIG_KEY = 'invoicepro_middleware_config';
const LEGACY_QUEUE_KEY = 'invoicepro_sync_queue';

export type { CaptureDeltaParams };

export interface MiddlewareSyncConfig {
  enabled: boolean;
  apiUrl: string;
  userId: string;
  deviceId: string;
}

async function migrateLegacyConfig(): Promise<void> {
  const legacy = await storageDriver.read<MiddlewareSyncConfig | null>(LEGACY_CONFIG_KEY, null);
  if (!legacy) return;
  const enabled = await syncElectronStore.getSyncEnabled();
  if (!enabled && legacy.enabled) await syncElectronStore.setSyncEnabled(legacy.enabled);
  const url = await syncElectronStore.getMiddlewareUrl();
  if (!url && legacy.apiUrl) {
    await syncElectronStore.setMiddlewareUrl(legacy.apiUrl);
  }
  const uuid = await syncElectronStore.getUserUUID();
  if (!uuid && legacy.userId) await syncElectronStore.setUserUUID(legacy.userId);
}

/** Primary capture API — object params per middleware contract. */
export async function captureDelta(params: CaptureDeltaParams): Promise<void> {
  console.log('captureDelta called:', params.entity, params.operation);
  await migrateLegacyConfig();
  await enqueueDelta(params);
  void drainQueue().catch((err) => console.warn('[middleware-sync] drain after capture:', err));
}

export async function getSyncStatus(): Promise<SyncStatusSnapshot> {
  await migrateLegacyConfig();
  const syncEnabled = await syncElectronStore.getSyncEnabled();
  const queue = await syncElectronStore.getDeltaQueue();
  const lastSyncedAt = await syncElectronStore.getLastSyncedAt();

  if (!syncEnabled) {
    return { state: 'off', pendingCount: 0, lastSyncedAt, syncEnabled: false };
  }
  if (isDrainInProgress()) {
    return { state: 'syncing', pendingCount: queue.length, lastSyncedAt, syncEnabled: true };
  }
  if (queue.length > 0) {
    return { state: 'pending', pendingCount: queue.length, lastSyncedAt, syncEnabled: true };
  }
  return { state: 'synced', pendingCount: 0, lastSyncedAt, syncEnabled: true };
}

export const invoiceProMiddlewareSync = {
  async getConfig(): Promise<MiddlewareSyncConfig | null> {
    await migrateLegacyConfig();
    return {
      enabled: await syncElectronStore.getSyncEnabled(),
      apiUrl: await syncElectronStore.getMiddlewareUrl(),
      userId: await syncElectronStore.getUserUUID(),
      deviceId: generateId('device'),
    };
  },

  async setConfig(config: Partial<MiddlewareSyncConfig>): Promise<MiddlewareSyncConfig> {
    if (config.enabled !== undefined) await syncElectronStore.setSyncEnabled(config.enabled);
    if (config.apiUrl !== undefined) await syncElectronStore.setMiddlewareUrl(config.apiUrl);
    if (config.userId !== undefined) await syncElectronStore.setUserUUID(config.userId);
    return (await this.getConfig())!;
  },

  async isEnabled(): Promise<boolean> {
    const cfg = await this.getConfig();
    return Boolean(cfg?.enabled && cfg.apiUrl && cfg.userId);
  },

  /** Legacy positional signature — delegates to captureDelta. */
  async captureDelta(
    entityType: string,
    entityId: string,
    operation: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await captureDelta({
      entity: entityType,
      operation: operation.toLowerCase() === 'delete' ? 'delete' : 'upsert',
      payload: { ...payload, id: entityId },
      companyId: '',
      userId: (await syncElectronStore.getUserUUID()) || '',
    });
  },

  flushQueue: drainQueue,

  async getQueueDepth(): Promise<number> {
    const queue = await syncElectronStore.getDeltaQueue();
    return queue.length;
  },
};

export { initDrainListeners, schedulePostLoginDrain, drainQueue };
