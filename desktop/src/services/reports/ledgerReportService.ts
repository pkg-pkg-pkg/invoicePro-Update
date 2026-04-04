import { LedgerAccount, LedgerTransaction } from '../../types/masters';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerTransactionService } from '../masters/ledgerTransactionService';

export interface LedgerStatementFilters {
  fromDate?: string;
  toDate?: string;
}

export interface LedgerStatementEntry extends LedgerTransaction {
  runningBalance: number;
}

export interface LedgerStatement {
  ledger: LedgerAccount;
  openingBalance: number;
  closingBalance: number;
  transactions: LedgerStatementEntry[];
}

const parseDateOrThrow = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    throw new Error('Invalid date provided');
  }
  return ts;
};

const isBefore = (timestamp: number, boundary: number | null) =>
  boundary !== null && timestamp < boundary;

const isAfter = (timestamp: number, boundary: number | null) =>
  boundary !== null && timestamp > boundary;

const computeLedgerOpening = (
  ledger: LedgerAccount,
  transactions: LedgerTransaction[],
  fromTs: number | null
) => {
  let opening =
    ledger.openingBalanceType === 'DEBIT'
      ? ledger.openingBalance
      : -ledger.openingBalance;

  if (fromTs === null) {
    return opening;
  }

  for (const txn of transactions) {
    const txnTs = Date.parse(txn.date);
    if (!Number.isNaN(txnTs) && txnTs < fromTs) {
      opening += txn.debit - txn.credit;
    }
  }

  return Number(opening.toFixed(4));
};

export const ledgerReportService = {
  async getStatement(ledgerId: string, filters: LedgerStatementFilters = {}): Promise<LedgerStatement> {
    const ledger = await ledgerAccountService.getById(ledgerId);
    if (!ledger) {
      throw new Error('Ledger not found');
    }

    const fromTs = parseDateOrThrow(filters.fromDate);
    const toTs = parseDateOrThrow(filters.toDate);
    if (fromTs !== null && toTs !== null && fromTs > toTs) {
      throw new Error('From date cannot be after To date');
    }

    const transactions = await ledgerTransactionService.list({ ledgerId });

    const openingBalance = computeLedgerOpening(ledger, transactions, fromTs);
    const statementEntries: LedgerStatementEntry[] = [];
    let running = openingBalance;

    for (const txn of transactions) {
      const txnTs = Date.parse(txn.date);
      if (Number.isNaN(txnTs)) {
        continue;
      }
      if (isBefore(txnTs, fromTs)) {
        continue;
      }
      if (isAfter(txnTs, toTs)) {
        continue;
      }
      running = Number((running + txn.debit - txn.credit).toFixed(4));
      statementEntries.push({
        ...txn,
        runningBalance: running,
      });
    }

    const closingBalance =
      statementEntries.length > 0
        ? statementEntries[statementEntries.length - 1].runningBalance
        : openingBalance;

    return {
      ledger,
      openingBalance,
      closingBalance,
      transactions: statementEntries,
    };
  },
};
