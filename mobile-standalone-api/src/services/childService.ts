import oracledb from 'oracledb';
import { generateUuid } from '@pve/utils';
import { withConnection } from '../db/oracle';
import type { ModuleName, AccessLevel } from '../types/express';

const CHILD_FEE = 699;
const DEFAULT_MODULES: ModuleName[] = [
  'sales', 'purchase', 'ledger', 'receipts', 'items', 'customers', 'reports',
];

export async function createChild(
  parentId: string,
  mobileNo: string,
  name: string,
  permissions: Partial<Record<ModuleName, AccessLevel>>
) {
  const childId = generateUuid();
  const subId = generateUuid();
  const paidFrom = new Date();
  const paidUntil = new Date();
  paidUntil.setFullYear(paidUntil.getFullYear() + 1);

  await withConnection(parentId, async (conn) => {
    await conn.execute(
      `INSERT INTO child_users (child_id, parent_user_id, mobile_no, name) VALUES (:id, :parent, :mobile, :name)`,
      { id: childId, parent: parentId, mobile: mobileNo, name },
      { autoCommit: false }
    );

    await conn.execute(
      `INSERT INTO child_subscriptions (sub_id, child_id, parent_user_id, paid_from, paid_until, amount, status)
       VALUES (:subId, :childId, :parent, :from, :until, :amount, 'active')`,
      { subId, childId, parent: parentId, from: paidFrom, until: paidUntil, amount: CHILD_FEE },
      { autoCommit: false }
    );

    for (const mod of DEFAULT_MODULES) {
      const level = permissions[mod] ?? 'read';
      await conn.execute(
        `INSERT INTO child_permissions (perm_id, child_id, parent_user_id, module, access_level)
         VALUES (:permId, :childId, :parent, :module, :level)`,
        { permId: generateUuid(), childId, parent: parentId, module: mod, level },
        { autoCommit: false }
      );
    }

    await conn.commit();
  });

  return { child_id: childId, sub_id: subId };
}

export async function listChildren(parentId: string) {
  return withConnection(parentId, async (conn) => {
    const rs = await conn.execute(
      `SELECT c.*, s.paid_until, s.status AS sub_status
       FROM child_users c
       LEFT JOIN child_subscriptions s ON s.child_id = c.child_id AND s.status = 'active'
       WHERE c.parent_user_id = :parent ORDER BY c.created_at DESC`,
      { parent: parentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function updatePermissions(
  parentId: string,
  childId: string,
  permissions: Partial<Record<ModuleName, AccessLevel>>
) {
  await withConnection(parentId, async (conn) => {
    for (const [mod, level] of Object.entries(permissions)) {
      await conn.execute(
        `UPDATE child_permissions SET access_level = :level
         WHERE child_id = :childId AND parent_user_id = :parent AND module = :module`,
        { level, childId, parent: parentId, module: mod },
        { autoCommit: false }
      );
    }
    await conn.commit();
  });
}

export async function deactivateChild(parentId: string, childId: string) {
  await withConnection(parentId, async (conn) => {
    await conn.execute(
      `UPDATE child_users SET status = 'inactive' WHERE child_id = :childId AND parent_user_id = :parent`,
      { childId, parent: parentId },
      { autoCommit: false }
    );
    await conn.execute(
      `UPDATE child_subscriptions SET status = 'cancelled' WHERE child_id = :childId`,
      { childId },
      { autoCommit: true }
    );
  });
}

export async function renewSubscription(parentId: string, childId: string) {
  const subId = generateUuid();
  const paidFrom = new Date();
  const paidUntil = new Date();
  paidUntil.setFullYear(paidUntil.getFullYear() + 1);

  await withConnection(parentId, async (conn) => {
    await conn.execute(
      `UPDATE child_subscriptions SET status = 'expired' WHERE child_id = :childId AND status = 'active'`,
      { childId },
      { autoCommit: false }
    );
    await conn.execute(
      `INSERT INTO child_subscriptions (sub_id, child_id, parent_user_id, paid_from, paid_until, amount, status)
       VALUES (:subId, :childId, :parent, :from, :until, :amount, 'active')`,
      { subId, childId, parent: parentId, from: paidFrom, until: paidUntil, amount: CHILD_FEE },
      { autoCommit: true }
    );
  });

  return { sub_id: subId, paid_until: paidUntil };
}

export async function getSubscriptions(parentId: string, childId?: string) {
  return withConnection(parentId, async (conn) => {
    const sql = childId
      ? `SELECT * FROM child_subscriptions WHERE parent_user_id = :parent AND child_id = :childId`
      : `SELECT * FROM child_subscriptions WHERE parent_user_id = :parent`;
    const rs = await conn.execute(sql, { parent: parentId, childId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return rs.rows || [];
  });
}
