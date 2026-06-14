import { generateUuid } from '@pve/utils';
import { withConnection, OUT_FORMAT_OBJECT } from '../db';

/** Generic list query filtered by user_id. */
export async function listByUser(table: string, userId: string, limit = 100, offset = 0) {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT * FROM ${table} WHERE user_id = :userId ORDER BY updated_at DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { userId, offset, limit },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function getById(table: string, idCol: string, id: string, userId: string) {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT * FROM ${table} WHERE ${idCol} = :id AND user_id = :userId`,
      { id, userId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return (rs.rows as unknown[])?.[0] || null;
  });
}

export async function insertRecord(
  table: string,
  idCol: string,
  userId: string,
  data: Record<string, unknown>,
  source = 'mobile'
) {
  const id = generateUuid();
  const cols = Object.keys(data);
  const colList = [idCol, 'user_id', 'updated_at', 'source', ...cols].join(', ');
  const binds: Record<string, unknown> = {
    [idCol]: id,
    user_id: userId,
    updated_at: new Date(),
    source,
    ...data,
  };
  const placeholders = Object.keys(binds).map((k) => `:${k}`).join(', ');

  await withConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
      binds,
      { autoCommit: true }
    );
  });

  return { [idCol]: id, ...data };
}

export async function updateRecord(
  table: string,
  idCol: string,
  id: string,
  userId: string,
  data: Record<string, unknown>
) {
  const setClause = Object.keys(data).map((c) => `${c} = :${c}`).join(', ');
  const binds = { ...data, id, userId, updated_at: new Date() };

  await withConnection(async (conn) => {
    const result = await conn.execute(
      `UPDATE ${table} SET ${setClause}, updated_at = :updated_at WHERE ${idCol} = :id AND user_id = :userId`,
      binds,
      { autoCommit: true }
    );
    if ((result.rowsAffected ?? 0) === 0) {
      throw new Error('Record not found');
    }
  });

  return { [idCol]: id, ...data };
}

export async function getPartyLedger(userId: string, partyId: string) {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT * FROM ledger_entries WHERE user_id = :userId AND party_id = :partyId
       ORDER BY entry_date ASC, updated_at ASC`,
      { userId, partyId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function getSalesReport(userId: string, fromDate?: string, toDate?: string) {
  return withConnection(async (conn) => {
    let sql = `SELECT invoice_date, COUNT(*) AS invoice_count, SUM(total_amount) AS total_sales,
                      SUM(tax_amount) AS total_tax
               FROM invoices WHERE user_id = :userId`;
    const binds: Record<string, unknown> = { userId };

    if (fromDate) {
      sql += ` AND invoice_date >= TO_DATE(:fromDate, 'YYYY-MM-DD')`;
      binds.fromDate = fromDate;
    }
    if (toDate) {
      sql += ` AND invoice_date <= TO_DATE(:toDate, 'YYYY-MM-DD')`;
      binds.toDate = toDate;
    }
    sql += ` GROUP BY invoice_date ORDER BY invoice_date DESC`;

    const rs = await conn.execute(sql, binds, { outFormat: OUT_FORMAT_OBJECT });
    return rs.rows || [];
  });
}

export async function getOutstandingReport(userId: string) {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT party_id,
              SUM(debit) - SUM(credit) AS balance
       FROM ledger_entries
       WHERE user_id = :userId
       GROUP BY party_id
       HAVING SUM(debit) - SUM(credit) != 0
       ORDER BY balance DESC`,
      { userId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}
