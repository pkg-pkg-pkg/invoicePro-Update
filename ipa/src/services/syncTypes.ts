export interface DeltaRecord {
  record_type: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;
  device_id: string;
  user_id: string;
}
