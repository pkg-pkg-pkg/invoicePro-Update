import oracledb from 'oracledb';
import { generateUuid } from '@pve/utils';
import { withConnection } from '../db/oracle';

export async function list(
  ownerId: string,
  table: string,
  orderCol = 'created_at',
  limit = 50,
  offset = 0
) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT * FROM ${table} WHERE user_id = :userId ORDER BY ${orderCol} DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { userId: ownerId, offset, limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function getById(ownerId: string, table: string, idCol: string, id: string) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT * FROM ${table} WHERE ${idCol} = :id AND user_id = :userId`,
      { id, userId: ownerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (rs.rows as unknown[])?.[0] || null;
  });
}

export async function create(
  ownerId: string,
  table: string,
  idCol: string,
  data: Record<string, unknown>
) {
  const id = generateUuid();
  const cols = Object.keys(data);
  const colList = [idCol, 'user_id', ...cols].join(', ');
  const binds: Record<string, unknown> = { [idCol]: id, user_id: ownerId, ...data };
  const placeholders = Object.keys(binds).map((k) => `:${k}`).join(', ');

  await withConnection(ownerId, async (conn) => {
    await conn.execute(
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
      binds,
      { autoCommit: true }
    );
  });

  return { [idCol]: id, user_id: ownerId, ...data };
}

export async function update(
  ownerId: string,
  table: string,
  idCol: string,
  id: string,
  data: Record<string, unknown>
) {
  const setClause = Object.keys(data).map((c) => `${c} = :${c}`).join(', ');
  const binds = { ...data, id, userId: ownerId };

  await withConnection(ownerId, async (conn) => {
    const result = await conn.execute(
      `UPDATE ${table} SET ${setClause} WHERE ${idCol} = :id AND user_id = :userId`,
      binds,
      { autoCommit: true }
    );
    if ((result.rowsAffected ?? 0) === 0) throw new Error('Record not found');
  });

  return { [idCol]: id, ...data };
}

export async function remove(ownerId: string, table: string, idCol: string, id: string) {
  await withConnection(ownerId, async (conn) => {
    const result = await conn.execute(
      `DELETE FROM ${table} WHERE ${idCol} = :id AND user_id = :userId`,
      { id, userId: ownerId },
      { autoCommit: true }
    );
    if ((result.rowsAffected ?? 0) === 0) throw new Error('Record not found');
  });
}
