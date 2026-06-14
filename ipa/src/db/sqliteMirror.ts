import type { DeltaRecord } from '../services/syncTypes';
import { generateUuid } from '@pve/utils';
import { withSqliteConnection } from './sqliteDb';

/** Mirror deltas into dev-friendly vouchers/parties/items JSON tables. */
export async function mirrorDeltaToDevTables(delta: DeltaRecord): Promise<void> {
  const payload = JSON.stringify(delta.data);
  const updatedAt = delta.timestamp;
  const source = 'desktop';

  await withSqliteConnection(async (conn) => {
    if (delta.record_type === 'invoice' || delta.record_type === 'receipt' || delta.record_type === 'ledger') {
      await conn.execute(
        `INSERT INTO vouchers (voucher_id, user_id, record_type, payload, updated_at, source)
         VALUES (:id, :userId, :type, :payload, :updatedAt, :source)
         ON CONFLICT(voucher_id) DO UPDATE SET payload=:payload, updated_at=:updatedAt, source=:source`,
        {
          id: delta.record_id,
          userId: delta.user_id,
          type: delta.record_type,
          payload,
          updatedAt,
          source,
        }
      );
    } else if (delta.record_type === 'customer') {
      await conn.execute(
        `INSERT INTO parties (party_id, user_id, record_type, payload, updated_at, source)
         VALUES (:id, :userId, 'customer', :payload, :updatedAt, :source)
         ON CONFLICT(party_id) DO UPDATE SET payload=:payload, updated_at=:updatedAt`,
        { id: delta.record_id, userId: delta.user_id, payload, updatedAt, source }
      );
    } else if (delta.record_type === 'item') {
      await conn.execute(
        `INSERT INTO items (item_id, user_id, name, updated_at, source, extra_data)
         VALUES (:id, :userId, :name, :updatedAt, :source, :payload)
         ON CONFLICT(item_id) DO UPDATE SET extra_data=:payload, updated_at=:updatedAt`,
        {
          id: delta.record_id,
          userId: delta.user_id,
          name: String(delta.data.name ?? delta.data.item_name ?? 'Item'),
          payload,
          updatedAt,
          source,
        }
      );
    }
  });
}

export async function insertSyncLogEntry(
  delta: DeltaRecord,
  action: string,
  deviceId: string
): Promise<void> {
  await withSqliteConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO sync_log (sync_id, device_id, user_id, record_type, record_id, action)
       VALUES (:syncId, :deviceId, :userId, :type, :recId, :action)`,
      {
        syncId: generateUuid(),
        deviceId,
        userId: delta.user_id,
        type: delta.record_type,
        recId: delta.record_id,
        action,
      }
    );
  });
}
