import type { Voucher, VoucherType } from '../../types/vouchers';
import { voucherService } from '../vouchers/voucherService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { voucherGrandTotal } from '../voucherPrintBuilder';
import { deleteExpenseVoucher } from '../expenses/expenseVoucherService';
import { getVoucherEditPath } from '../../utils/voucherNavigation';
import { normalizeToYmd } from '../../utils/dateRange';
export { getVoucherEditPath };

const EXPENSES_KEY = 'expenses';

export type DayBookSource = 'voucher' | 'expense';

export interface DayBookEntry {
  id: string;
  source: DayBookSource;
  date: string;
  voucherType: string;
  voucherTypeKey: string;
  voucherNumber: string;
  partyName: string;
  description: string;
  debit: number;
  credit: number;
  amount: number;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  voucher?: Voucher;
  linesDetail?: { ledgerName: string; debit: number; credit: number }[];
  editPath: string | null;
  viewPath: string | null;
}

export interface DayBookFilters {
  date: string;
  voucherType?: string;
  partyName?: string;
  amount?: string;
  createdBy?: string;
  includeDeleted?: boolean;
}

export interface DayBookTotals {
  totalDebit: number;
  totalCredit: number;
  totalVouchers: number;
  totalSales: number;
  totalReceipts: number;
}

export interface DayBookResult {
  date: string;
  entries: DayBookEntry[];
  totals: DayBookTotals;
}

type StoredExpense = {
  id: string;
  date: string;
  amount: number;
  description?: string;
  expenseHeadName?: string;
  createdBy?: string;
  voucherId?: string | null;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

const VOUCHER_TYPE_OPTIONS = [
  'Sales Invoice',
  'Purchase Invoice',
  'Receipt Voucher',
  'Payment Voucher',
  'Journal Voucher',
  'Credit Note',
  'Debit Note',
  'Expense Entry',
  'Contra Entry',
  'Bank Entry',
  'Opening Balance Entry',
] as const;

export const DAY_BOOK_VOUCHER_TYPES = VOUCHER_TYPE_OPTIONS;

function partyFromVoucher(voucher: Voucher, ledgerMap: Map<string, string>): string {
  const customerLine =
    voucher.type === 'SALES' || voucher.type === 'SALES_RETURN'
      ? voucher.lines.find((l) => Number(l.debit ?? 0) > 0)
      : voucher.type === 'PURCHASE' || voucher.type === 'PURCHASE_RETURN'
        ? voucher.lines.find((l) => Number(l.credit ?? 0) > 0)
        : voucher.lines.find((l) => Number(l.debit ?? 0) > 0 || Number(l.credit ?? 0) > 0);
  const paymentLine =
    voucher.type === 'RECEIPT'
      ? voucher.lines.find((l) => Number(l.credit ?? 0) > 0)
      : voucher.type === 'PAYMENT'
        ? voucher.lines.find((l) => Number(l.debit ?? 0) > 0)
        : undefined;
  const partyLine = customerLine ?? paymentLine ?? voucher.lines[0];
  const id = partyLine?.ledgerId;
  return (id && ledgerMap.get(id)) || '—';
}

function voucherDebitCredit(voucher: Voucher): { debit: number; credit: number; amount: number } {
  const debit = Number(
    voucher.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0).toFixed(2)
  );
  const credit = Number(
    voucher.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0).toFixed(2)
  );
  return { debit, credit, amount: Math.max(debit, credit) };
}

export function resolveDayBookTypeLabel(voucher: Voucher): { label: string; key: string } {
  const narration = String(voucher.narration || '').toLowerCase();
  const number = String(voucher.number || '');

  if (voucher.type === 'SALES') return { label: 'Sales Invoice', key: 'sales-invoice' };
  if (voucher.type === 'PURCHASE') return { label: 'Purchase Invoice', key: 'purchase-invoice' };
  if (voucher.type === 'RECEIPT') {
    if (narration.includes('bank')) return { label: 'Bank Entry', key: 'bank-entry' };
    return { label: 'Receipt Voucher', key: 'receipt-voucher' };
  }
  if (voucher.type === 'PAYMENT') {
    if (number.startsWith('EXP-') || narration.startsWith('expense:')) {
      return { label: 'Expense Entry', key: 'expense-entry' };
    }
    if (narration.includes('bank')) return { label: 'Bank Entry', key: 'bank-entry' };
    return { label: 'Payment Voucher', key: 'payment-voucher' };
  }
  if (voucher.type === 'JOURNAL') {
    if (narration.includes('opening balance') || narration.includes('opening bal')) {
      return { label: 'Opening Balance Entry', key: 'opening-balance' };
    }
    return { label: 'Journal Voucher', key: 'journal-voucher' };
  }
  if (voucher.type === 'CONTRA') return { label: 'Contra Entry', key: 'contra-entry' };
  if (voucher.type === 'SALES_RETURN') return { label: 'Credit Note', key: 'credit-note' };
  if (voucher.type === 'PURCHASE_RETURN') return { label: 'Debit Note', key: 'debit-note' };
  const fallbackType = String(voucher.type);
  return { label: fallbackType, key: fallbackType.toLowerCase() };
}

function voucherEntry(voucher: Voucher, ledgerMap: Map<string, string>): DayBookEntry {
  const { label, key } = resolveDayBookTypeLabel(voucher);
  const { debit, credit, amount } = voucherDebitCredit(voucher);
  const editPath = getVoucherEditPath(voucher);
  return {
    id: voucher.id,
    source: 'voucher',
    date: normalizeToYmd(voucher.date),
    voucherType: label,
    voucherTypeKey: key,
    voucherNumber: voucher.number,
    partyName: partyFromVoucher(voucher, ledgerMap),
    description: voucher.narration || '—',
    debit,
    credit,
    amount,
    createdBy: voucher.createdBy || '—',
    isDeleted: Boolean(voucher.isDeleted),
    deletedAt: voucher.deletedAt,
    deletedBy: voucher.deletedBy,
    voucher,
    linesDetail: voucher.lines.map((line) => ({
      ledgerName: ledgerMap.get(line.ledgerId) || line.ledgerId,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
    })),
    editPath,
    viewPath: editPath,
  };
}

function expenseEntry(expense: StoredExpense): DayBookEntry {
  const amount = Number(expense.amount || 0);
  return {
    id: expense.id,
    source: 'expense',
    date: normalizeToYmd(expense.date),
    voucherType: 'Expense Entry',
    voucherTypeKey: 'expense-entry',
    voucherNumber: expense.description?.slice(0, 24) || `EXP-${expense.id}`,
    partyName: expense.expenseHeadName || '—',
    description: expense.description || '—',
    debit: amount,
    credit: amount,
    amount,
    createdBy: expense.createdBy || '—',
    isDeleted: Boolean(expense.isDeleted),
    deletedAt: expense.deletedAt,
    deletedBy: expense.deletedBy,
    editPath: '/expenses',
    viewPath: '/expenses',
  };
}

async function readExpenses(): Promise<StoredExpense[]> {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    return raw ? (JSON.parse(raw) as StoredExpense[]) : [];
  } catch {
    return [];
  }
}

async function writeExpenses(rows: StoredExpense[]): Promise<void> {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(rows));
}

function matchesFilters(entry: DayBookEntry, filters: DayBookFilters): boolean {
  if (!filters.includeDeleted && entry.isDeleted) return false;
  if (normalizeToYmd(entry.date) !== normalizeToYmd(filters.date)) return false;
  if (filters.voucherType && filters.voucherType !== 'ALL' && entry.voucherType !== filters.voucherType) {
    return false;
  }
  if (filters.partyName?.trim()) {
    const q = filters.partyName.trim().toLowerCase();
    if (!entry.partyName.toLowerCase().includes(q)) return false;
  }
  if (filters.createdBy?.trim()) {
    const q = filters.createdBy.trim().toLowerCase();
    if (!entry.createdBy.toLowerCase().includes(q)) return false;
  }
  if (filters.amount?.trim()) {
    const q = filters.amount.trim();
    const num = Number(q);
    if (Number.isFinite(num)) {
      if (Math.abs(entry.amount - num) > 0.01) return false;
    } else if (!String(entry.amount).includes(q)) {
      return false;
    }
  }
  return true;
}

function computeTotals(entries: DayBookEntry[]): DayBookTotals {
  const active = entries.filter((e) => !e.isDeleted);
  return {
    totalDebit: Number(active.reduce((s, e) => s + e.debit, 0).toFixed(2)),
    totalCredit: Number(active.reduce((s, e) => s + e.credit, 0).toFixed(2)),
    totalVouchers: active.length,
    totalSales: Number(
      active
        .filter((e) => e.voucherType === 'Sales Invoice')
        .reduce((s, e) => s + e.amount, 0)
        .toFixed(2)
    ),
    totalReceipts: Number(
      active
        .filter((e) => e.voucherType === 'Receipt Voucher' || e.voucherType === 'Bank Entry')
        .reduce((s, e) => s + e.amount, 0)
        .toFixed(2)
    ),
  };
}

export const dayBookService = {
  async fetch(filters: DayBookFilters): Promise<DayBookResult> {
    const [vouchers, ledgers, expenses] = await Promise.all([
      voucherService.list({ includeDeleted: Boolean(filters.includeDeleted) }),
      ledgerAccountService.list({ includeInactive: true }),
      readExpenses(),
    ]);

    const ledgerMap = new Map(ledgers.map((l) => [l.id, l.name]));
    const voucherIdSet = new Set(vouchers.map((v) => v.id));

    const voucherEntries = vouchers
      .filter((v) => v.status !== 'CANCELLED' || filters.includeDeleted)
      .map((v) => voucherEntry(v, ledgerMap));

    const standaloneExpenses = expenses
      .filter((e) => !e.voucherId || !voucherIdSet.has(String(e.voucherId)))
      .map(expenseEntry);

    const all = [...voucherEntries, ...standaloneExpenses]
      .filter((entry) => matchesFilters(entry, filters))
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return a.voucherNumber.localeCompare(b.voucherNumber);
      });

    return {
      date: filters.date,
      entries: all,
      totals: computeTotals(all),
    };
  },

  async deleteEntry(entry: DayBookEntry, deletedBy: string): Promise<void> {
    if (entry.source === 'voucher') {
      await voucherService.delete(entry.id);
      return;
    }

    const expenses = await readExpenses();
    const index = expenses.findIndex((e) => e.id === entry.id);
    if (index < 0) throw new Error('Expense entry not found');
    const target = expenses[index];
    if (target.voucherId) {
      try {
        await deleteExpenseVoucher(target.voucherId);
      } catch {
        await voucherService.delete(target.voucherId);
      }
    }
    expenses[index] = {
      ...target,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy,
    };
    await writeExpenses(expenses);
  },

  async restoreEntry(entry: DayBookEntry): Promise<void> {
    if (entry.source === 'voucher') {
      await voucherService.restore(entry.id);
      return;
    }

    const expenses = await readExpenses();
    const index = expenses.findIndex((e) => e.id === entry.id);
    if (index < 0) throw new Error('Expense entry not found');
    const target = expenses[index];
    expenses[index] = {
      ...target,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
    };
    await writeExpenses(expenses);
  },

  async duplicateVoucher(voucher: Voucher): Promise<Voucher> {
    const copyNo = `${voucher.number}-COPY`;
    return voucherService.create({
      type: voucher.type,
      date: new Date().toISOString().slice(0, 10),
      number: copyNo,
      narration: voucher.narration,
      lines: voucher.lines.map((line) => ({
        ledgerId: line.ledgerId,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        itemId: line.itemId,
        quantity: line.quantity,
        godownId: line.godownId,
        taxType: line.taxType,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        igstAmount: line.igstAmount,
        cgstLedgerId: line.cgstLedgerId,
        sgstLedgerId: line.sgstLedgerId,
        igstLedgerId: line.igstLedgerId,
        chargeType: line.chargeType,
        isTaxable: line.isTaxable,
        roundOffAmount: line.roundOffAmount,
      })),
    });
  },
};
