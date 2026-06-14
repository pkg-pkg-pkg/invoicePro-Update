import { generateUuid } from '@pve/utils';
import { withConnection, OUT_FORMAT_OBJECT } from '../db';
import { applyDeltaFromPending } from './childApprovalService';

const CHILD_ANNUAL_FEE = 699;

export async function createChild(
  parentUserId: string,
  mobileNo: string,
  name: string
): Promise<{ child_id: string; sub_id: string }> {
  const childId = generateUuid();
  const subId = generateUuid();
  const paidFrom = new Date();
  const paidUntil = new Date();
  paidUntil.setFullYear(paidUntil.getFullYear() + 1);

  await withConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO child_users (child_id, parent_user_id, mobile_no, name, status)
       VALUES (:childId, :parentId, :mobile, :name, 'active')`,
      { childId, parentId: parentUserId, mobile: mobileNo, name },
      { autoCommit: false }
    );

    await conn.execute(
      `INSERT INTO child_subscriptions (sub_id, child_id, parent_user_id, paid_from, paid_until, amount, status)
       VALUES (:subId, :childId, :parentId, :paidFrom, :paidUntil, :amount, 'active')`,
      {
        subId,
        childId,
        parentId: parentUserId,
        paidFrom,
        paidUntil,
        amount: CHILD_ANNUAL_FEE,
      },
      { autoCommit: false }
    );

    await conn.commit();
  });

  return { child_id: childId, sub_id: subId };
}

export async function listChildren(parentUserId: string) {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT c.child_id, c.mobile_no, c.name, c.status, c.created_at,
              s.paid_until, s.status AS sub_status
       FROM child_users c
       LEFT JOIN child_subscriptions s ON s.child_id = c.child_id
         AND s.status = 'active'
       WHERE c.parent_user_id = :parentId
       ORDER BY c.created_at DESC`,
      { parentId: parentUserId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function deactivateChild(parentUserId: string, childId: string): Promise<void> {
  await withConnection(async (conn) => {
    await conn.execute(
      `UPDATE child_users SET status = 'inactive' WHERE child_id = :childId AND parent_user_id = :parentId`,
      { childId, parentId: parentUserId },
      { autoCommit: false }
    );
    await conn.execute(
      `UPDATE child_subscriptions SET status = 'cancelled' WHERE child_id = :childId AND parent_user_id = :parentId`,
      { childId, parentId: parentUserId },
      { autoCommit: false }
    );
    await conn.commit();
  });
}

export async function getPendingChanges(parentUserId: string) {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT p.*, c.name AS child_name
       FROM child_pending p
       JOIN child_users c ON c.child_id = p.child_id
       WHERE p.parent_user_id = :parentId AND p.status = 'pending'
       ORDER BY p.submitted_at DESC`,
      { parentId: parentUserId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function approvePending(
  parentUserId: string,
  pendingIds: string[]
): Promise<number> {
  let approved = 0;
  for (const pendingId of pendingIds) {
    const applied = await applyDeltaFromPending(parentUserId, pendingId, 'approved');
    if (applied) approved++;
  }
  return approved;
}

export async function rejectPending(
  parentUserId: string,
  pendingIds: string[]
): Promise<number> {
  let rejected = 0;
  for (const pendingId of pendingIds) {
    const done = await applyDeltaFromPending(parentUserId, pendingId, 'rejected');
    if (done) rejected++;
  }
  return rejected;
}

export async function getSubscriptionStatus(parentUserId: string, childId?: string) {
  return withConnection(async (conn) => {
    const sql = childId
      ? `SELECT * FROM child_subscriptions WHERE parent_user_id = :parentId AND child_id = :childId ORDER BY paid_until DESC`
      : `SELECT * FROM child_subscriptions WHERE parent_user_id = :parentId ORDER BY paid_until DESC`;
    const rs = await conn.execute(sql, { parentId: parentUserId, childId }, { outFormat: OUT_FORMAT_OBJECT });
    return rs.rows || [];
  });
}

export async function renewSubscription(parentUserId: string, childId: string) {
  const subId = generateUuid();
  const paidFrom = new Date();
  const paidUntil = new Date();
  paidUntil.setFullYear(paidUntil.getFullYear() + 1);

  await withConnection(async (conn) => {
    await conn.execute(
      `UPDATE child_subscriptions SET status = 'expired' WHERE child_id = :childId AND status = 'active'`,
      { childId },
      { autoCommit: false }
    );
    await conn.execute(
      `INSERT INTO child_subscriptions (sub_id, child_id, parent_user_id, paid_from, paid_until, amount, status)
       VALUES (:subId, :childId, :parentId, :paidFrom, :paidUntil, :amount, 'active')`,
      { subId, childId, parentId: parentUserId, paidFrom, paidUntil, amount: CHILD_ANNUAL_FEE },
      { autoCommit: true }
    );
  });

  return { sub_id: subId, paid_until: paidUntil };
}

export async function isChildSubscriptionActive(childId: string): Promise<boolean> {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT 1 FROM child_subscriptions
       WHERE child_id = :childId AND status = 'active' AND paid_until >= TRUNC(SYSDATE)`,
      { childId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return (rs.rows?.length ?? 0) > 0;
  });
}
