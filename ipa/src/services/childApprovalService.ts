import { withConnection, OUT_FORMAT_OBJECT } from '../db';
import { pushDeltas, type DeltaRecord } from './syncService';

/** Approve or reject a single pending child change. */
export async function applyDeltaFromPending(
  parentUserId: string,
  pendingId: string,
  decision: 'approved' | 'rejected'
): Promise<boolean> {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT * FROM child_pending WHERE pending_id = :id AND parent_user_id = :parentId AND status = 'pending'`,
      { id: pendingId, parentId: parentUserId },
      { outFormat: OUT_FORMAT_OBJECT }
    );

    const row = (rs.rows as Record<string, unknown>[])?.[0];
    if (!row) return false;

    if (decision === 'approved') {
      const payload = JSON.parse(String(row.RECORD_DATA)) as Record<string, unknown>;
      const delta: DeltaRecord = {
        record_type: String(row.RECORD_TYPE),
        record_id: String(payload.record_id),
        action: String(row.ACTION) as 'insert' | 'update',
        data: payload,
        timestamp: String(payload.timestamp || new Date().toISOString()),
        device_id: 'child-approval',
        user_id: parentUserId,
      };
      await pushDeltas([delta]);
    }

    await conn.execute(
      `UPDATE child_pending SET status = :status, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = :reviewer
       WHERE pending_id = :id`,
      { status: decision, reviewer: parentUserId, id: pendingId },
      { autoCommit: true }
    );

    return true;
  });
}
