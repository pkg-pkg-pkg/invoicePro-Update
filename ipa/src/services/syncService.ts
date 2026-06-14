import { generateUuid } from '@pve/utils';
import { withConnection, OUT_FORMAT_OBJECT, useSqlite, type DbConnection } from '../db';
import { mirrorDeltaToDevTables } from '../db/sqliteMirror';

export type { DeltaRecord } from './syncTypes';
import type { DeltaRecord } from './syncTypes';

const TABLE_MAP: Record<string, { table: string; idCol: string }> = {
  invoice: { table: 'invoices', idCol: 'invoice_id' },
  customer: { table: 'customers', idCol: 'customer_id' },
  item: { table: 'items', idCol: 'item_id' },
  receipt: { table: 'receipts', idCol: 'receipt_id' },
  ledger: { table: 'ledger_entries', idCol: 'entry_id' },
};

/** Apply a single delta with last-write-wins conflict resolution. */
async function applyDelta(delta: DeltaRecord, source: 'desktop' | 'mobile'): Promise<void> {
  const mapping = TABLE_MAP[delta.record_type];
  if (!mapping) {
    throw new Error(`Unsupported record_type: ${delta.record_type}`);
  }

  await withConnection(async (conn) => {
    const existing = await conn.execute(
      `SELECT updated_at FROM ${mapping.table} WHERE ${mapping.idCol} = :id AND user_id = :userId`,
      { id: delta.record_id, userId: delta.user_id },
      { outFormat: OUT_FORMAT_OBJECT }
    );

    const row = (existing.rows as { UPDATED_AT?: Date }[])?.[0];
    const incomingTs = new Date(delta.timestamp);

    if (row?.UPDATED_AT && row.UPDATED_AT > incomingTs) {
      // Conflict — existing record is newer; log and skip
      await conn.execute(
        `INSERT INTO conflict_log (conflict_id, record_type, record_id, winner)
         VALUES (:id, :type, :recId, :winner)`,
        {
          id: generateUuid(),
          type: delta.record_type,
          recId: delta.record_id,
          winner: source === 'desktop' ? 'desktop' : 'mobile',
        },
        { autoCommit: false }
      );
      await conn.commit();
      return;
    }

    if (delta.action === 'delete') {
      await conn.execute(
        `DELETE FROM ${mapping.table} WHERE ${mapping.idCol} = :id AND user_id = :userId`,
        { id: delta.record_id, userId: delta.user_id },
        { autoCommit: false }
      );
    } else {
      await upsertRecord(conn, mapping.table, mapping.idCol, delta, source);
    }

    await conn.execute(
      `INSERT INTO sync_log (sync_id, device_id, user_id, record_type, record_id, action)
       VALUES (:syncId, :deviceId, :userId, :type, :recId, :action)`,
      {
        syncId: generateUuid(),
        deviceId: delta.device_id,
        userId: delta.user_id,
        type: delta.record_type,
        recId: delta.record_id,
        action: delta.action,
      },
      { autoCommit: false }
    );

    await conn.commit();

    if (useSqlite()) {
      await mirrorDeltaToDevTables(delta);
    }
  });
}

async function upsertRecord(
  conn: DbConnection,
  table: string,
  idCol: string,
  delta: DeltaRecord,
  source: string
): Promise<void> {
  const data = delta.data;
  const cols = Object.keys(data);
  const binds: Record<string, unknown> = {
    [idCol]: delta.record_id,
    user_id: delta.user_id,
    updated_at: new Date(delta.timestamp),
    source,
    ...data,
  };

  const setClause = cols.map((c) => `${c} = :${c}`).join(', ');
  const colList = [idCol, 'user_id', 'updated_at', 'source', ...cols].join(', ');
  const valList = [':invoice_id', ':user_id', ':updated_at', ':source', ...cols.map((c) => `:${c}`)].join(', ');

  // Use MERGE for upsert
  const mergeSql = `
    MERGE INTO ${table} t
    USING (SELECT :${idCol} AS ${idCol} FROM dual) s
    ON (t.${idCol} = s.${idCol} AND t.user_id = :user_id)
    WHEN MATCHED THEN UPDATE SET ${setClause || `${idCol} = :${idCol}`}, updated_at = :updated_at, source = :source
    WHEN NOT MATCHED THEN INSERT (${colList}) VALUES (${valList.replace(':invoice_id', `:${idCol}`)})
  `;

  binds[idCol] = delta.record_id;
  await conn.execute(mergeSql, binds, { autoCommit: false });
}

/** Desktop pushes one or more delta records. */
export async function pushDeltas(deltas: DeltaRecord[]): Promise<{ accepted: number; skipped: number }> {
  let accepted = 0;
  let skipped = 0;
  for (const delta of deltas) {
    try {
      await applyDelta(delta, 'desktop');
      accepted++;
    } catch (err) {
      console.error('Delta push failed:', err);
      skipped++;
    }
  }
  return { accepted, skipped };
}

/** Mobile pushes edits — child users go to pending queue instead. */
export async function mobilePushDelta(
  delta: DeltaRecord,
  isChild: boolean,
  childId?: string,
  parentUserId?: string
): Promise<{ status: 'applied' | 'pending_approval' }> {
  if (isChild && childId && parentUserId) {
    if (delta.action === 'delete') {
      throw new Error('Child users cannot delete records');
    }
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO child_pending (pending_id, child_id, parent_user_id, record_type, action, record_data)
         VALUES (:id, :childId, :parentId, :type, :action, :data)`,
        {
          id: generateUuid(),
          childId,
          parentId: parentUserId,
          type: delta.record_type,
          action: delta.action,
          data: JSON.stringify({ ...delta.data, record_id: delta.record_id, timestamp: delta.timestamp }),
        },
        { autoCommit: true }
      );
    });
    return { status: 'pending_approval' };
  }

  await applyDelta(delta, 'mobile');
  return { status: 'applied' };
}

/** Fetch all records updated since last_sync_at for a user. */
export async function fetchSince(
  userId: string,
  lastSyncAt?: string
): Promise<Record<string, unknown[]>> {
  const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0);

  return withConnection(async (conn) => {
    const result: Record<string, unknown[]> = {};

    for (const [type, mapping] of Object.entries(TABLE_MAP)) {
      const rs = await conn.execute(
        `SELECT * FROM ${mapping.table} WHERE user_id = :userId AND updated_at > :since`,
        { userId, since },
        { outFormat: OUT_FORMAT_OBJECT }
      );
      result[type] = (rs.rows as unknown[]) || [];
    }

    return result;
  });
}
