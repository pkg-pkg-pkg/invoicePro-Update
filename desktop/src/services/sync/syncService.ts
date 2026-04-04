import { syncQueue } from './syncQueue';
import { pushEngine } from './pushEngine';
import { pullEngine } from './pullEngine';
import { syncLogger } from './syncLogger';
import { syncMetrics } from './syncMetrics';
import { SyncEvent, SyncOperation } from './syncTypes';

let initialized = false;

export const syncService = {
  init(): void {
    if (initialized) return;
    initialized = true;

    pushEngine.start(5000);
    pullEngine.start(10000);

    console.log('[syncService] initialized');
  },

  stop(): void {
    pushEngine.stop();
    pullEngine.stop();
    initialized = false;
    console.log('[syncService] stopped');
  },

  async capture(
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    payload: unknown,
    version?: number | string | null
  ): Promise<void> {
    syncLogger.info({
      event: 'enqueue',
      code: 'SYNC_CAPTURE_REQUEST',
      message: 'Capture invoked from storage layer',
      entityType,
      entityId,
      operation,
    });
    await syncQueue.enqueue(entityType, entityId, operation, payload, version);
  },

  async flushPush(): Promise<void> {
    await pushEngine.flush();
  },

  async triggerPull(): Promise<void> {
    await pullEngine.pull();
  },

  async getQueueStatus(): Promise<{ pending: number; synced: number; failed: number }> {
    const all = await syncQueue.getAll();
    return {
      pending: all.filter((e) => e.status === 'pending' || e.status === 'syncing').length,
      synced: all.filter((e) => e.status === 'synced').length,
      failed: all.filter((e) => e.status === 'failed').length,
    };
  },

  async getDiagnostics(): Promise<{
    metrics: ReturnType<typeof syncMetrics.getSnapshot>;
    queueDepth: number;
    queueSample: SyncEvent[];
  }> {
    const metrics = syncMetrics.getSnapshot();
    const queue = await syncQueue.getAll();
    const sample = queue.slice(-5);
    return {
      metrics,
      queueDepth: queue.length,
      queueSample: sample,
    };
  },

  async clearQueue(): Promise<void> {
    await syncQueue.clear();
  },

  isRunning(): boolean {
    return pushEngine.isRunning() && pullEngine.isRunning();
  },
};
