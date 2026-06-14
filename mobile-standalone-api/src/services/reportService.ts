import oracledb from 'oracledb';
import { withConnection } from '../db/oracle';

export async function profitAndLoss(ownerId: string, fromDate?: string, toDate?: string) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT ag.type, ag.name AS group_name, SUM(ve.credit - ve.debit) AS net
       FROM voucher_entries ve
       JOIN accounts a ON a.account_id = ve.account_id
       JOIN account_groups ag ON ag.group_id = a.group_id
       JOIN vouchers v ON v.voucher_id = ve.voucher_id
       WHERE v.user_id = :userId AND ag.type IN ('income', 'expense')
       GROUP BY ag.type, ag.name
       ORDER BY ag.type, ag.name`,
      { userId: ownerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function balanceSheet(ownerId: string) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT ag.type, a.name AS account_name,
              a.opening_bal + NVL(SUM(ve.debit - ve.credit), 0) AS balance
       FROM accounts a
       JOIN account_groups ag ON ag.group_id = a.group_id
       LEFT JOIN voucher_entries ve ON ve.account_id = a.account_id
       WHERE a.user_id = :userId AND ag.type IN ('asset', 'liability')
       GROUP BY ag.type, a.name, a.opening_bal
       ORDER BY ag.type, a.name`,
      { userId: ownerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function trialBalance(ownerId: string) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT a.name, SUM(ve.debit) AS total_debit, SUM(ve.credit) AS total_credit
       FROM accounts a
       LEFT JOIN voucher_entries ve ON ve.account_id = a.account_id
       WHERE a.user_id = :userId
       GROUP BY a.name
       ORDER BY a.name`,
      { userId: ownerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function gstr1Summary(ownerId: string, month?: string) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT si.invoice_date, si.invoice_no, si.cgst, si.sgst, si.igst, si.total,
              c.gstin AS customer_gstin
       FROM sales_invoices si
       LEFT JOIN customers c ON c.customer_id = si.customer_id
       WHERE si.user_id = :userId AND si.status = 'final'
       ORDER BY si.invoice_date DESC`,
      { userId: ownerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function outstanding(ownerId: string) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT c.customer_id, c.name, SUM(si.total) AS invoiced,
              NVL((SELECT SUM(ve.credit) FROM voucher_entries ve
                   JOIN vouchers v ON v.voucher_id = ve.voucher_id
                   WHERE v.user_id = :userId AND v.voucher_type = 'receipt'), 0) AS received
       FROM customers c
       LEFT JOIN sales_invoices si ON si.customer_id = c.customer_id
       WHERE c.user_id = :userId
       GROUP BY c.customer_id, c.name`,
      { userId: ownerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}

export async function accountLedger(ownerId: string, accountId: string) {
  return withConnection(ownerId, async (conn) => {
    const rs = await conn.execute(
      `SELECT v.voucher_date, v.voucher_type, v.narration, ve.debit, ve.credit
       FROM voucher_entries ve
       JOIN vouchers v ON v.voucher_id = ve.voucher_id
       WHERE v.user_id = :userId AND ve.account_id = :accountId
       ORDER BY v.voucher_date ASC`,
      { userId: ownerId, accountId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return rs.rows || [];
  });
}
