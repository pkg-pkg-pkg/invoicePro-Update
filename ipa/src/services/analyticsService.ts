import { withConnection, OUT_FORMAT_OBJECT } from '../db';

export type DashboardSummary = {
  todaySales: number;
  todayReceipts: number;
  outstandingAmount: number;
  stockValue: number;
  todaySalesVsPriorPct: number;
  todayReceiptsVsPriorPct: number;
  outstandingVsPriorPct: number;
  stockValueVsPriorPct: number;
  financialYear: string;
};

export type DayBookEntry = {
  id: string;
  date: string;
  voucherType: string;
  voucherNumber: string;
  partyName: string;
  description: string;
  debit: number;
  credit: number;
  amount: number;
  createdBy: string;
  isDeleted?: boolean;
};

export type DayBookResponse = {
  entries: DayBookEntry[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    totalVouchers: number;
    totalSales: number;
    totalReceipts: number;
  };
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function priorDayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function financialYearLabel(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 4) return `FY ${y}-${String(y + 1).slice(-2)}`;
  return `FY ${y - 1}-${String(y).slice(-2)}`;
}

function pctChange(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const today = todayIso();
  const prior = priorDayIso();

  return withConnection(async (conn) => {
    const salesTodayRs = await conn.execute(
      `SELECT COALESCE(SUM(total_amount), 0) AS amt FROM invoices
       WHERE user_id = :userId AND invoice_date = :today`,
      { userId, today },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    const salesPriorRs = await conn.execute(
      `SELECT COALESCE(SUM(total_amount), 0) AS amt FROM invoices
       WHERE user_id = :userId AND invoice_date = :prior`,
      { userId, prior },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    const receiptsTodayRs = await conn.execute(
      `SELECT COALESCE(SUM(amount), 0) AS amt FROM receipts
       WHERE user_id = :userId AND receipt_date = :today`,
      { userId, today },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    const receiptsPriorRs = await conn.execute(
      `SELECT COALESCE(SUM(amount), 0) AS amt FROM receipts
       WHERE user_id = :userId AND receipt_date = :prior`,
      { userId, prior },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    const outstandingRs = await conn.execute(
      `SELECT COALESCE(SUM(debit) - SUM(credit), 0) AS bal FROM ledger_entries WHERE user_id = :userId`,
      { userId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    const itemsRs = await conn.execute(
      `SELECT sale_rate, extra_data FROM items WHERE user_id = :userId`,
      { userId },
      { outFormat: OUT_FORMAT_OBJECT }
    );

    const todaySales = Number((salesTodayRs.rows as Record<string, number>[])?.[0]?.AMT ?? 0);
    const priorSales = Number((salesPriorRs.rows as Record<string, number>[])?.[0]?.AMT ?? 0);
    const todayReceipts = Number((receiptsTodayRs.rows as Record<string, number>[])?.[0]?.AMT ?? 0);
    const priorReceipts = Number((receiptsPriorRs.rows as Record<string, number>[])?.[0]?.AMT ?? 0);
    const outstandingAmount = Number((outstandingRs.rows as Record<string, number>[])?.[0]?.BAL ?? 0);

    let stockValue = 0;
    for (const row of (itemsRs.rows as Record<string, unknown>[]) || []) {
      const rate = Number(row.SALE_RATE ?? 0);
      let stock = 0;
      try {
        const extra = row.EXTRA_DATA ? JSON.parse(String(row.EXTRA_DATA)) : {};
        stock = Number((extra as Record<string, unknown>).stock ?? (extra as Record<string, unknown>).openingStock ?? 0);
      } catch {
        stock = 0;
      }
      stockValue += rate * stock;
    }

    return {
      todaySales,
      todayReceipts,
      outstandingAmount,
      stockValue,
      todaySalesVsPriorPct: pctChange(todaySales, priorSales),
      todayReceiptsVsPriorPct: pctChange(todayReceipts, priorReceipts),
      outstandingVsPriorPct: 0,
      stockValueVsPriorPct: 0,
      financialYear: financialYearLabel(),
    };
  });
}

export async function getDayBook(
  userId: string,
  opts: { date?: string; type?: string; party?: string; amount?: string; showDeleted?: boolean }
): Promise<DayBookResponse> {
  const date = opts.date || todayIso();
  const entries: DayBookEntry[] = [];

  return withConnection(async (conn) => {
    const invRs = await conn.execute(
      `SELECT invoice_id, invoice_no, invoice_date, total_amount, tax_amount, status, extra_data
       FROM invoices WHERE user_id = :userId AND invoice_date = :date`,
      { userId, date },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    for (const row of (invRs.rows as Record<string, unknown>[]) || []) {
      entries.push({
        id: String(row.INVOICE_ID),
        date: String(row.INVOICE_DATE || date),
        voucherType: 'sales_invoice',
        voucherNumber: String(row.INVOICE_NO || row.INVOICE_ID),
        partyName: '',
        description: 'Sales Invoice',
        debit: Number(row.TOTAL_AMOUNT || 0),
        credit: 0,
        amount: Number(row.TOTAL_AMOUNT || 0),
        createdBy: 'system',
      });
    }

    const rcRs = await conn.execute(
      `SELECT receipt_id, receipt_date, amount, mode, extra_data FROM receipts
       WHERE user_id = :userId AND receipt_date = :date`,
      { userId, date },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    for (const row of (rcRs.rows as Record<string, unknown>[]) || []) {
      entries.push({
        id: String(row.RECEIPT_ID),
        date: String(row.RECEIPT_DATE || date),
        voucherType: 'receipt',
        voucherNumber: String(row.RECEIPT_ID),
        partyName: '',
        description: `Receipt (${row.MODE || 'cash'})`,
        debit: 0,
        credit: Number(row.AMOUNT || 0),
        amount: Number(row.AMOUNT || 0),
        createdBy: 'system',
      });
    }

    try {
      const vRs = await conn.execute(
        `SELECT voucher_id, record_type, payload, updated_at FROM vouchers
         WHERE user_id = :userId`,
        { userId },
        { outFormat: OUT_FORMAT_OBJECT }
      );
      for (const row of (vRs.rows as Record<string, unknown>[]) || []) {
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(String(row.PAYLOAD || '{}')) as Record<string, unknown>;
        } catch {
          payload = {};
        }
        const vDate = String(payload.date || payload.voucherDate || row.UPDATED_AT || '').slice(0, 10);
        if (vDate && vDate !== date) continue;
        const vType = String(row.RECORD_TYPE || payload.type || 'voucher');
        if (opts.type && opts.type !== 'all' && vType !== opts.type) continue;
        const partyName = String(payload.partyName || payload.customerName || payload.vendorName || '');
        if (opts.party && !partyName.toLowerCase().includes(opts.party.toLowerCase())) continue;
        const amount = Number(payload.grandTotal || payload.amount || payload.totalAmount || 0);
        if (opts.amount && String(amount) !== opts.amount) continue;
        entries.push({
          id: String(row.VOUCHER_ID),
          date: vDate || date,
          voucherType: vType,
          voucherNumber: String(payload.number || payload.voucherNumber || row.VOUCHER_ID),
          partyName,
          description: String(payload.narration || payload.notes || vType),
          debit: Number(payload.debit || amount),
          credit: Number(payload.credit || 0),
          amount,
          createdBy: String(payload.createdBy || 'desktop'),
          isDeleted: Boolean(payload.isDeleted),
        });
      }
    } catch {
      // vouchers table may not exist on Oracle
    }

    const filtered = opts.showDeleted ? entries : entries.filter((e) => !e.isDeleted);
    const totalDebit = filtered.reduce((s, e) => s + e.debit, 0);
    const totalCredit = filtered.reduce((s, e) => s + e.credit, 0);
    const totalSales = filtered.filter((e) => e.voucherType.includes('sales')).reduce((s, e) => s + e.amount, 0);
    const totalReceipts = filtered.filter((e) => e.voucherType === 'receipt').reduce((s, e) => s + e.amount, 0);

    return {
      entries: filtered,
      totals: {
        totalDebit,
        totalCredit,
        totalVouchers: filtered.length,
        totalSales,
        totalReceipts,
      },
    };
  });
}

export async function listVouchersByType(userId: string, type?: string) {
  const results: Record<string, unknown>[] = [];

  return withConnection(async (conn) => {
    if (!type || type === 'sales_invoice' || type === 'purchase_bill') {
      const invRs = await conn.execute(
        `SELECT * FROM invoices WHERE user_id = :userId ORDER BY updated_at DESC`,
        { userId },
        { outFormat: OUT_FORMAT_OBJECT }
      );
      for (const row of (invRs.rows as Record<string, unknown>[]) || []) {
        const vType = type === 'purchase_bill' ? 'purchase_bill' : 'sales_invoice';
        if (type && type !== vType && type !== 'sales_invoice') continue;
        results.push({
          id: row.INVOICE_ID,
          documentNo: row.INVOICE_NO,
          date: row.INVOICE_DATE,
          partyId: row.CUSTOMER_ID,
          amount: row.TOTAL_AMOUNT,
          gstAmount: row.TAX_AMOUNT,
          balanceDue: row.TOTAL_AMOUNT,
          status: row.STATUS || 'open',
          voucherType: vType,
        });
      }
    }

    try {
      const vRs = await conn.execute(
        `SELECT voucher_id, record_type, payload, updated_at FROM vouchers WHERE user_id = :userId`,
        { userId },
        { outFormat: OUT_FORMAT_OBJECT }
      );
      for (const row of (vRs.rows as Record<string, unknown>[]) || []) {
        const recordType = String(row.RECORD_TYPE || '');
        if (type && recordType !== type) continue;
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(String(row.PAYLOAD || '{}')) as Record<string, unknown>;
        } catch {
          payload = {};
        }
        results.push({
          id: row.VOUCHER_ID,
          documentNo: payload.number || payload.voucherNumber || row.VOUCHER_ID,
          date: payload.date || payload.voucherDate || row.UPDATED_AT,
          partyName: payload.partyName || payload.customerName || payload.vendorName,
          amount: payload.grandTotal || payload.amount || payload.totalAmount || 0,
          gstAmount: payload.gstAmount || payload.taxAmount || 0,
          balanceDue: payload.balanceDue || payload.balance || 0,
          status: payload.status || 'open',
          voucherType: recordType,
        });
      }
    } catch {
      // optional table
    }

    return results;
  });
}

export async function listLedgerAccounts(userId: string) {
  return withConnection(async (conn) => {
    const rs = await conn.execute(
      `SELECT party_id,
              SUM(debit) AS total_debit,
              SUM(credit) AS total_credit,
              SUM(debit) - SUM(credit) AS balance
       FROM ledger_entries WHERE user_id = :userId
       GROUP BY party_id ORDER BY party_id`,
      { userId },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    return (rs.rows || []).map((row: Record<string, unknown>) => ({
      id: row.PARTY_ID,
      name: row.PARTY_ID,
      debit: row.TOTAL_DEBIT,
      credit: row.TOTAL_CREDIT,
      balance: row.BALANCE,
    }));
  });
}

export function emptyReportRows(label: string) {
  return { report: label, rows: [], generatedAt: new Date().toISOString() };
}

export function emptyGstReport(name: string, month?: string, year?: string) {
  return {
    report: name,
    month: month || '',
    year: year || '',
    b2b: [],
    b2c: [],
    hsnSummary: [],
    generatedAt: new Date().toISOString(),
  };
}
