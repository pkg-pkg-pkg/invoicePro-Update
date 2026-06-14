import { getHostBaseUrl } from '../docApi';
import { systemLogger } from '../logging/systemLogger';
import { syncAuth } from '../auth/syncAuth';
import { rbac } from '../auth/rbac';
import { auditService } from '../audit/auditService';
import { syncQueue } from './syncQueue';
import { syncLogger } from './syncLogger';
import { syncMetrics } from './syncMetrics';
import { SyncEvent } from './syncTypes';

const isOnline = (): boolean => {
  try {
    return navigator.onLine;
  } catch {
    return true;
  }
};

const pushToHost = async (event: SyncEvent): Promise<void> => {
  const base = getHostBaseUrl();
  if (!base) {
    throw new Error('Host not configured');
  }

  const endpoint = `${base}/api/sync/push`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    syncMetrics.recordPushAttempt();
    syncLogger.info({
      event: 'push_attempt',
      code: 'SYNC_PUSH_ATTEMPT',
      message: 'Pushing event to host',
      eventId: event.id,
      entityType: event.entityType,
      operation: event.operation,
    });
    const authHeaders = syncAuth.getAuthHeaders();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        entityType: event.entityType,
        entityId: event.entityId,
        operation: event.operation,
        payload: event.payload,
        version: event.version,
        timestamp: event.timestamp,
        source: event.source,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`PUSH_${res.status}: ${txt}`);
    }

    syncMetrics.recordPushSuccess();
    syncLogger.info({
      event: 'push_success',
      code: 'SYNC_PUSH_SUCCESS',
      message: 'Push succeeded',
      eventId: event.id,
      entityType: event.entityType,
      operation: event.operation,
    });

    await auditService.logSyncPush(event.entityType, event.entityId, {
      operation: event.operation,
    });
  } finally {
    clearTimeout(timeout);
  }
};

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let loggedPushPermissionDenied = false;

const processQueue = async (): Promise<void> => {
  if (running) return;

  const base = getHostBaseUrl();
  if (!base) {
    return;
  }

  if (!rbac.canPushSync()) {
    if (!loggedPushPermissionDenied) {
      loggedPushPermissionDenied = true;
      syncLogger.warn({
        event: 'push_failure',
        code: 'SYNC_PUSH_PERMISSION_DENIED',
        message: 'User lacks sync:push permission',
      });
    }
    return;
  }

  if (!isOnline()) {
    syncLogger.warn({
      event: 'push_failure',
      code: 'SYNC_PUSH_OFFLINE',
      message: 'Offline; skipping push cycle',
    });
    return;
  }

  running = true;

  try {
    const pending = await syncQueue.getPending();
    syncLogger.info({
      event: 'queue_status',
      code: 'SYNC_QUEUE_PENDING',
      message: 'Processing pending events',
      pending: pending.length,
    });

    for (const event of pending) {
      await syncQueue.markSyncing(event.id);

      try {
        await pushToHost(event);
        await syncQueue.markSynced(event.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        syncLogger.error({
          event: 'push_failure',
          code: 'SYNC_PUSH_FAILURE',
          message: 'Push failed',
          eventId: event.id,
          error: msg,
        });
        syncMetrics.recordPushFailure(msg);
        await syncQueue.markFailed(event.id, msg);
      }
    }

    await syncQueue.removeSynced();
  } finally {
    running = false;
  }
};

export const pushEngine = {
  start(intervalMs = 5000): void {
    if (intervalId) return;
    systemLogger.info('sync', {
      event: 'push_engine_start',
      code: 'SYNC_PUSH_ENGINE_START',
      message: 'Push engine started',
      intervalMs,
    });
    intervalId = setInterval(() => {
      processQueue().catch((err) => {
        syncLogger.error({
          event: 'push_failure',
          code: 'SYNC_PUSH_LOOP_ERROR',
          message: 'Push loop error',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, intervalMs);

    processQueue().catch((err) =>
      syncLogger.error({
        event: 'push_failure',
        code: 'SYNC_PUSH_INITIAL_ERROR',
        message: 'Initial push run failed',
        error: err instanceof Error ? err.message : String(err),
      })
    );

    window.addEventListener('online', () => {
      syncLogger.info({
        event: 'push_attempt',
        code: 'SYNC_PUSH_ONLINE_TRIGGER',
        message: 'Online event detected; triggering push',
      });
      processQueue().catch((err) =>
        syncLogger.error({
          event: 'push_failure',
          code: 'SYNC_PUSH_ONLINE_ERROR',
          message: 'Push after online event failed',
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
        event: 'push_engine_stop',
        code: 'SYNC_PUSH_ENGINE_STOP',
        message: 'Push engine stopped',
      });
    }
  },

  async flush(): Promise<void> {
    await processQueue();
  },

  isRunning(): boolean {
    return intervalId !== null;
  },
};
