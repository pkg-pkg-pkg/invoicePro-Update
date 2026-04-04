import { storageDriver } from '../storage/storageDriver';
import { getHostBaseUrl } from '../docApi';
import { systemLogger } from '../logging/systemLogger';
import { syncAuth } from '../auth/syncAuth';
import { rbac } from '../auth/rbac';
import { auditService } from '../audit/auditService';
import { syncLogger } from './syncLogger';
import { syncMetrics } from './syncMetrics';
import { SyncChange } from './syncTypes';

const CURSOR_KEY = 'pve_sync_cursor';

const readCursor = async (): Promise<string | null> => {
  return storageDriver.read<string>(CURSOR_KEY, null as unknown as string);
};

const writeCursor = async (cursor: string): Promise<void> => {
  await storageDriver.write(CURSOR_KEY, cursor);
};

const isOnline = (): boolean => {
  try {
    return navigator.onLine;
  } catch {
    return true;
  }
};

const ENTITY_STORAGE_KEYS: Record<string, string> = {
  ledger_groups: 'pve_ledger_groups',
  ledger_accounts: 'pve_ledger_accounts',
  inventory_items: 'pve_inventory_items',
  item_categories: 'pve_item_categories',
  units_of_measure: 'pve_units_of_measure',
  godowns: 'pve_godowns',
  vouchers: 'pve_vouchers',
  ledger_transactions: 'pve_ledger_transactions',
};

const applyChange = async (change: SyncChange): Promise<void> => {
  const storageKey = ENTITY_STORAGE_KEYS[change.entityType];
  if (!storageKey) {
    syncLogger.warn({
      event: 'conflict_skip',
      code: 'SYNC_PULL_UNKNOWN_ENTITY',
      message: 'Unknown entity type in pull payload',
      entityType: change.entityType,
    });
    syncMetrics.recordConflict(`unknown_entity:${change.entityType}`);
    return;
  }

  const list = await storageDriver.read<any[]>(storageKey, []);
  const items = Array.isArray(list) ? list : [];

  const idx = items.findIndex((item) => item?.id === change.entityId);

  if (change.operation === 'CREATE') {
    if (idx >= 0) {
      syncLogger.warn({
        event: 'conflict_skip',
        code: 'SYNC_PULL_CREATE_EXISTS',
        message: 'CREATE skipped because record already exists',
        entityType: change.entityType,
        entityId: change.entityId,
      });
      syncMetrics.recordConflict(`create_exists:${change.entityType}`);
      return;
    }
    items.push(change.payload);
  } else if (change.operation === 'UPDATE') {
    if (idx < 0) {
      syncLogger.warn({
        event: 'conflict_skip',
        code: 'SYNC_PULL_UPDATE_NOT_FOUND',
        message: 'UPDATE skipped because record not found',
        entityType: change.entityType,
        entityId: change.entityId,
      });
      syncMetrics.recordConflict(`update_missing:${change.entityType}`);
      return;
    }
    const existing = items[idx];
    const incomingVersion = (change.payload as any)?.updatedAt ?? change.timestamp;
    const existingVersion = existing?.updatedAt ?? '';
    if (existingVersion && incomingVersion <= existingVersion) {
      syncLogger.warn({
        event: 'conflict_skip',
        code: 'SYNC_PULL_UPDATE_STALE',
        message: 'UPDATE skipped because incoming version is stale',
        entityType: change.entityType,
        entityId: change.entityId,
      });
      syncMetrics.recordConflict(`update_stale:${change.entityType}`);
      return;
    }
    items[idx] = { ...existing, ...(change.payload as object) };
  } else if (change.operation === 'DELETE') {
    if (idx < 0) {
      syncLogger.warn({
        event: 'conflict_skip',
        code: 'SYNC_PULL_DELETE_NOT_FOUND',
        message: 'DELETE skipped because record not found',
        entityType: change.entityType,
        entityId: change.entityId,
      });
      syncMetrics.recordConflict(`delete_missing:${change.entityType}`);
      return;
    }
    const existing = items[idx];
    if (existing?.isActive === false || existing?.status === 'INACTIVE') {
      syncLogger.warn({
        event: 'conflict_skip',
        code: 'SYNC_PULL_DELETE_INACTIVE',
        message: 'DELETE skipped because record already inactive',
        entityType: change.entityType,
        entityId: change.entityId,
      });
      syncMetrics.recordConflict(`delete_inactive:${change.entityType}`);
      return;
    }
    items[idx] = { ...existing, isActive: false, status: 'INACTIVE', updatedAt: change.timestamp };
  }

  await storageDriver.write(storageKey, items);
  syncLogger.info({
    event: 'pull_apply',
    code: 'SYNC_PULL_APPLY_SUCCESS',
    message: 'Applied pulled change',
    entityType: change.entityType,
    entityId: change.entityId,
    operation: change.operation,
  });
};

const fetchChanges = async (cursor: string | null): Promise<{ changes: SyncChange[]; nextCursor: string | null }> => {
  const base = getHostBaseUrl();
  if (!base) {
    throw new Error('Host not configured');
  }

  const url = cursor ? `${base}/api/sync/pull?cursor=${encodeURIComponent(cursor)}` : `${base}/api/sync/pull`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    syncMetrics.recordPullAttempt();
    syncLogger.info({
      event: 'pull_fetch',
      code: 'SYNC_PULL_FETCH_START',
      message: 'Fetching remote changes',
      cursor,
    });
    const authHeaders = syncAuth.getAuthHeaders();
    const res = await fetch(url, { headers: authHeaders, signal: controller.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`PULL_${res.status}: ${txt}`);
    }

    const data = await res.json();
    const changes = Array.isArray(data?.changes) ? data.changes : [];
    syncMetrics.recordPullSuccess(data?.nextCursor ?? cursor ?? null, changes.length);
    syncLogger.info({
      event: 'pull_fetch',
      code: 'SYNC_PULL_FETCH_SUCCESS',
      message: 'Fetched remote changes',
      cursor,
      fetched: changes.length,
    });
    return {
      changes,
      nextCursor: data?.nextCursor ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
};

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

const processPull = async (): Promise<void> => {
  if (running) return;

  if (!rbac.canPullSync()) {
    syncLogger.warn({
      event: 'pull_error',
      code: 'SYNC_PULL_PERMISSION_DENIED',
      message: 'User lacks sync:pull permission',
    });
    return;
  }

  if (!isOnline()) {
    syncLogger.warn({
      event: 'pull_error',
      code: 'SYNC_PULL_OFFLINE',
      message: 'Offline; skipping pull cycle',
    });
    return;
  }

  const base = getHostBaseUrl();
  if (!base) {
    return;
  }

  running = true;

  try {
    const cursor = await readCursor();
    const { changes, nextCursor } = await fetchChanges(cursor);

    syncLogger.info({
      event: 'pull_fetch',
      code: 'SYNC_PULL_APPLY_BATCH',
      message: 'Applying pulled changes',
      fetched: changes.length,
    });

    for (const change of changes) {
      try {
        await applyChange(change);
        await auditService.logSyncPull(change.entityType, change.entityId, {
          operation: change.operation,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        syncLogger.error({
          event: 'pull_error',
          code: 'SYNC_PULL_APPLY_ERROR',
          message: 'Failed to apply change',
          entityType: change.entityType,
          entityId: change.entityId,
          error: msg,
        });
      }
    }

    if (nextCursor) {
      await writeCursor(nextCursor);
      syncLogger.info({
        event: 'pull_fetch',
        code: 'SYNC_PULL_CURSOR_UPDATE',
        message: 'Updated pull cursor',
        nextCursor,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    syncMetrics.recordPullFailure(msg);
    syncLogger.error({
      event: 'pull_error',
      code: 'SYNC_PULL_FAILURE',
      message: 'Pull failed',
      error: msg,
    });
  } finally {
    running = false;
  }
};

export const pullEngine = {
  start(intervalMs = 10000): void {
    if (intervalId) return;
    systemLogger.info('sync', {
      event: 'pull_engine_start',
      code: 'SYNC_PULL_ENGINE_START',
      message: 'Pull engine started',
      intervalMs,
    });
    intervalId = setInterval(() => {
      processPull().catch((err) =>
        syncLogger.error({
          event: 'pull_error',
          code: 'SYNC_PULL_LOOP_ERROR',
          message: 'Pull loop error',
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }, intervalMs);

    processPull().catch((err) =>
      syncLogger.error({
        event: 'pull_error',
        code: 'SYNC_PULL_INITIAL_ERROR',
        message: 'Initial pull run failed',
        error: err instanceof Error ? err.message : String(err),
      })
    );

    window.addEventListener('online', () => {
      syncLogger.info({
        event: 'pull_fetch',
        code: 'SYNC_PULL_ONLINE_TRIGGER',
        message: 'Online event detected; triggering pull',
      });
      processPull().catch((err) =>
        syncLogger.error({
          event: 'pull_error',
          code: 'SYNC_PULL_ONLINE_ERROR',
          message: 'Pull after online event failed',
          error: err instanceof Error ? err.message : String(err),
        })
      );
    });
  },

  stop(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      systemLogger.info('sync', {
        event: 'pull_engine_stop',
        code: 'SYNC_PULL_ENGINE_STOP',
        message: 'Pull engine stopped',
      });
    }
  },

  async pull(): Promise<void> {
    await processPull();
  },

  isRunning(): boolean {
    return intervalId !== null;
  },

  async resetCursor(): Promise<void> {
    await storageDriver.remove(CURSOR_KEY);
  },
};
