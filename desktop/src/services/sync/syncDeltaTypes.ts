export type DeltaOperation = 'upsert' | 'delete';

export interface CaptureDeltaParams {
  entity: string;
  operation: DeltaOperation;
  payload: Record<string, unknown>;
  companyId: string;
  userId: string;
}

export interface QueuedDeltaItem {
  queue_id: string;
  record_type: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;
  device_id: string;
  user_id: string;
  company_id: string;
}

export interface DrainQueueResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

export type SyncUiState = 'off' | 'synced' | 'pending' | 'syncing';

export interface SyncStatusSnapshot {
  state: SyncUiState;
  pendingCount: number;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
}

export const SYNC_STATUS_CHANGED = 'pve:sync-status-changed';
