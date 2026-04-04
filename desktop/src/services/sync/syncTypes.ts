export type SyncOrigin = 'local' | 'remote';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncEvent {
  id: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  version?: number | string | null;
  timestamp: string;
  source: SyncOrigin;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  nextAttemptAt: number;
  lastError?: string | null;
}

export interface SyncChange {
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  version?: number | string | null;
  timestamp: string;
}
