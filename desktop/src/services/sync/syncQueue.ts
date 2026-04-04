import { generateId } from '../../utils/id';
import { storageDriver } from '../storage/storageDriver';
import { syncLogger } from './syncLogger';
import { syncMetrics } from './syncMetrics';
import { SyncEvent, SyncOperation } from './syncTypes';

const QUEUE_KEY = 'pve_sync_queue';

const readQueue = async (): Promise<SyncEvent[]> => {
  const data = await storageDriver.read<SyncEvent[]>(QUEUE_KEY, []);
  return Array.isArray(data) ? data : [];
};

const writeQueue = async (queue: SyncEvent[]): Promise<void> => {
  await storageDriver.write(QUEUE_KEY, queue);
  syncMetrics.updateQueue(queue);
};

export const syncQueue = {
  async enqueue(
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    payload: unknown,
    version?: number | string | null
  ): Promise<SyncEvent> {
    const queue = await readQueue();

    const event: SyncEvent = {
      id: generateId('sync'),
      entityType,
      entityId,
      operation,
      payload,
      version: version ?? null,
      timestamp: new Date().toISOString(),
      source: 'local',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: null,
    };

    queue.push(event);
    await writeQueue(queue);
    syncMetrics.recordEnqueue();
    syncLogger.info({
      event: 'enqueue',
      code: 'SYNC_ENQUEUE',
      message: 'Sync event enqueued',
      eventId: event.id,
      entityType,
      operation,
    });
    return event;
  },

  async getPending(): Promise<SyncEvent[]> {
    const queue = await readQueue();
    const now = Date.now();
    return queue.filter(
      (e) => (e.status === 'pending' || e.status === 'failed') && e.nextAttemptAt <= now
    );
  },

  async markSyncing(eventId: string): Promise<void> {
    const queue = await readQueue();
    const idx = queue.findIndex((e) => e.id === eventId);
    if (idx >= 0) {
      queue[idx] = { ...queue[idx], status: 'syncing' };
      await writeQueue(queue);
      syncLogger.info({
        event: 'queue_status',
        code: 'SYNC_MARK_SYNCING',
        message: 'Event marked as syncing',
        eventId,
      });
    }
  },

  async markSynced(eventId: string): Promise<void> {
    const queue = await readQueue();
    const idx = queue.findIndex((e) => e.id === eventId);
    if (idx >= 0) {
      queue[idx] = { ...queue[idx], status: 'synced' };
      await writeQueue(queue);
      syncLogger.info({
        event: 'queue_status',
        code: 'SYNC_MARK_SYNCED',
        message: 'Event marked as synced',
        eventId,
      });
    }
  },

  async markFailed(eventId: string, error: string): Promise<void> {
    const queue = await readQueue();
    const idx = queue.findIndex((e) => e.id === eventId);
    if (idx >= 0) {
      const attempts = queue[idx].attempts + 1;
      const backoff = Math.min(30000, 1000 * Math.pow(2, attempts));
      const jitter = Math.floor(Math.random() * 500);
      queue[idx] = {
        ...queue[idx],
        status: 'failed',
        attempts,
        nextAttemptAt: Date.now() + backoff + jitter,
        lastError: error,
      };
      await writeQueue(queue);
      syncMetrics.recordRetry();
      syncLogger.warn({
        event: 'retry_scheduled',
        code: 'SYNC_RETRY_SCHEDULED',
        message: 'Event marked as failed; retry scheduled',
        eventId,
        error,
        attempts,
        nextAttemptAt: queue[idx].nextAttemptAt,
      });
    }
  },

  async removeSynced(): Promise<number> {
    const queue = await readQueue();
    const remaining = queue.filter((e) => e.status !== 'synced');
    const removed = queue.length - remaining.length;
    await writeQueue(remaining);
    return removed;
  },

  async getAll(): Promise<SyncEvent[]> {
    return readQueue();
  },

  async clear(): Promise<void> {
    await writeQueue([]);
  },
};
