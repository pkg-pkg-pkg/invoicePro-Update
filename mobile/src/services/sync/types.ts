export type MobileSyncEntityType = 'ledger' | 'payment' | 'receipt' | 'invoice';

export interface MobileSyncEnvelope {
  id: string;
  idempotencyKey: string;
  entityType: MobileSyncEntityType;
  operation: 'CREATE';
  payload: Record<string, unknown>;
  timestamp: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  nextAttemptAt: number;
  lastError?: string | null;
}

export interface MobileSyncConfig {
  endpointBase: string;
  token: string;
  cursor: number;
}
