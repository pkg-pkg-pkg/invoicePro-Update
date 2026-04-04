import { LedgerTransaction } from '../../types/masters';
import { generateId } from '../../utils/id';
import { nowIso, readList, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_ledger_transactions';

export interface LedgerTransactionFilters {
  ledgerId?: string;
  fromDate?: string;
  toDate?: string;
  voucherType?: string;
  voucherId?: string;
}

const withinDateRange = (txnDate: string, from?: string, to?: string) => {
  const ts = new Date(txnDate).getTime();
  if (Number.isNaN(ts)) return false;
  if (from && ts < new Date(from).getTime()) return false;
  if (to && ts > new Date(to).getTime()) return false;
  return true;
};

const matchesFilters = (txn: LedgerTransaction, filters: LedgerTransactionFilters) => {
  if (filters.ledgerId && txn.ledgerId !== filters.ledgerId) return false;
  if (filters.voucherType && txn.voucherType !== filters.voucherType) return false;
  if (filters.voucherId && txn.voucherId !== filters.voucherId) return false;

  if ((filters.fromDate || filters.toDate) && !withinDateRange(txn.date, filters.fromDate, filters.toDate)) {
    return false;
  }

  return true;
};

const sortTransactions = (txns: LedgerTransaction[]) =>
  [...txns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export type NewLedgerTransaction = Omit<LedgerTransaction, 'id' | 'runningBalance' | 'createdAt'>;

export const ledgerTransactionService = {
  async list(filters: LedgerTransactionFilters = {}): Promise<LedgerTransaction[]> {
    const transactions = await readList<LedgerTransaction>(STORAGE_KEY);
    return sortTransactions(filters ? transactions.filter((txn) => matchesFilters(txn, filters)) : transactions);
  },

  async findByLedger(ledgerId: string, filters: Omit<LedgerTransactionFilters, 'ledgerId'> = {}) {
    return this.list({ ...filters, ledgerId });
  },

  async findByVoucher(voucherType: string, voucherId: string) {
    return this.list({ voucherType, voucherId });
  },

  async recordTransactions(entries: NewLedgerTransaction[]): Promise<LedgerTransaction[]> {
    if (!entries.length) {
      return [];
    }

    const transactions = await readList<LedgerTransaction>(STORAGE_KEY);
    const recorded: LedgerTransaction[] = [];

    for (const entry of entries) {
      const prior = [...transactions, ...recorded]
        .filter((txn) => txn.ledgerId === entry.ledgerId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .pop();

      const runningBalance = Number(
        ((prior?.runningBalance ?? 0) + entry.debit - entry.credit).toFixed(4)
      );

      const txn: LedgerTransaction = {
        ...entry,
        id: generateId('ltx'),
        runningBalance,
        createdAt: nowIso(),
      };

      transactions.push(txn);
      recorded.push(txn);
    }

    await writeList(STORAGE_KEY, transactions);
    return recorded;
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },
};
