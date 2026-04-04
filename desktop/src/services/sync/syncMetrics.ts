import { SyncEvent } from './syncTypes';

export interface SyncMetricsSnapshot {
  pending: number;
  synced: number;
  failed: number;
  lastEnqueueAt: string | null;
  lastPushAttemptAt: string | null;
  lastPushAt: string | null;
  lastPushError: string | null;
  lastPullAttemptAt: string | null;
  lastPullAt: string | null;
  lastPullError: string | null;
  lastConflict: string | null;
  retryCount: number;
  lastRetryAt: string | null;
  lastCursor: string | null;
  lastPullFetched: number;
}

const metrics: SyncMetricsSnapshot = {
  pending: 0,
  synced: 0,
  failed: 0,
  lastEnqueueAt: null,
  lastPushAttemptAt: null,
  lastPushAt: null,
  lastPushError: null,
  lastPullAttemptAt: null,
  lastPullAt: null,
  lastPullError: null,
  lastConflict: null,
  retryCount: 0,
  lastRetryAt: null,
  lastCursor: null,
  lastPullFetched: 0,
};

const snapshotQueueCounts = (queue: SyncEvent[]) => {
  metrics.pending = queue.filter((e) => e.status === 'pending' || e.status === 'syncing').length;
  metrics.synced = queue.filter((e) => e.status === 'synced').length;
  metrics.failed = queue.filter((e) => e.status === 'failed').length;
};

export const syncMetrics = {
  updateQueue(queue: SyncEvent[]): void {
    snapshotQueueCounts(queue);
  },

  recordEnqueue(): void {
    metrics.lastEnqueueAt = new Date().toISOString();
  },

  recordPushSuccess(): void {
    metrics.lastPushAt = new Date().toISOString();
    metrics.lastPushError = null;
  },

  recordPushAttempt(): void {
    metrics.lastPushAttemptAt = new Date().toISOString();
  },

  recordPushFailure(error: string): void {
    metrics.lastPushAt = new Date().toISOString();
    metrics.lastPushError = error;
  },

  recordPullAttempt(): void {
    metrics.lastPullAttemptAt = new Date().toISOString();
  },

  recordPullSuccess(cursor?: string | null, fetchedCount = 0): void {
    metrics.lastPullAt = new Date().toISOString();
    metrics.lastPullError = null;
    metrics.lastCursor = cursor ?? metrics.lastCursor;
    metrics.lastPullFetched = fetchedCount;
  },

  recordPullFailure(error: string): void {
    metrics.lastPullError = error;
  },

  recordRetry(): void {
    metrics.retryCount += 1;
    metrics.lastRetryAt = new Date().toISOString();
  },

  recordConflict(reason: string): void {
    metrics.lastConflict = `${new Date().toISOString()} | ${reason}`;
  },

  getSnapshot(): SyncMetricsSnapshot {
    return { ...metrics };
  },
};
