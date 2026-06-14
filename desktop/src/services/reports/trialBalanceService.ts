import { LedgerAccount, LedgerTransaction } from '../../types/masters';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerGroupService } from '../masters/ledgerGroupService';
import { ledgerTransactionService } from '../masters/ledgerTransactionService';

export interface TrialBalanceFilters {
  fromDate?: string;
  toDate?: string;
  includeInactive?: boolean;
}

export interface TrialBalanceEntry {
  ledger: LedgerAccount;
  debit: number;
  credit: number;
}

export interface TrialBalanceResult {
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
}

const parseDateOrThrow = (value?: string): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    throw new Error('Invalid date provided');
  }
  return ts;
};

const computeOpening = (
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

export const trialBalanceService = {
  async getTrialBalance(filters: TrialBalanceFilters = {}): Promise<TrialBalanceResult> {
    const fromTs = parseDateOrThrow(filters.fromDate);
    const toTs = parseDateOrThrow(filters.toDate);
    if (fromTs !== null && toTs !== null && fromTs > toTs) {
      throw new Error('From date cannot be after To date');
    }

    const ledgers = await ledgerAccountService.list({
      includeInactive: filters.includeInactive,
    });
    const groups = await ledgerGroupService.list({ includeInactive: filters.includeInactive });
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    const entries: TrialBalanceEntry[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const ledger of ledgers) {
      if (ledger.isActive === false && !filters.includeInactive) {
        continue;
      }
      const group = groupMap.get(ledger.groupId);
      if (!group) continue;

      const transactions = await ledgerTransactionService.list({ ledgerId: ledger.id });
      const opening = computeOpening(ledger, transactions, fromTs);

      let closing = opening;
      for (const txn of transactions) {
        const txnTs = Date.parse(txn.date);
        if (Number.isNaN(txnTs)) continue;
        if (fromTs !== null && txnTs < fromTs) continue;
        if (toTs !== null && txnTs > toTs) continue;
        closing += txn.debit - txn.credit;
      }
      closing = Number(closing.toFixed(4));

      const debit = closing > 0 ? closing : 0;
      const credit = closing < 0 ? Math.abs(closing) : 0;

      entries.push({
        ledger,
        debit,
        credit,
      });
      totalDebit += debit;
      totalCredit += credit;
    }

    totalDebit = Number(totalDebit.toFixed(4));
    totalCredit = Number(totalCredit.toFixed(4));

    return {
      entries,
      totalDebit,
      totalCredit,
    };
  },
};
