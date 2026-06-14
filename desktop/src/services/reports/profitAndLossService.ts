import type { LedgerGroup } from '../../types/masters';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerGroupService } from '../masters/ledgerGroupService';
import { ledgerTransactionService } from '../masters/ledgerTransactionService';

export interface ProfitAndLossFilters {
  fromDate?: string;
  toDate?: string;
  includeInactive?: boolean;
}

export interface ProfitAndLossGroupRow {
  groupId: string;
  groupName: string;
  groupType: 'INCOME' | 'EXPENSE';
  amount: number;
}

export interface ProfitAndLossResult {
  fromDate: string;
  toDate: string;
  incomeRows: ProfitAndLossGroupRow[];
  expenseRows: ProfitAndLossGroupRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

const parseDate = (value?: string): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

const round2 = (n: number) => Number(n.toFixed(2));

export const profitAndLossService = {
  async getProfitAndLoss(filters: ProfitAndLossFilters = {}): Promise<ProfitAndLossResult> {
    const fromTs = parseDate(filters.fromDate);
    const toTs = parseDate(filters.toDate);
    const [ledgers, groups] = await Promise.all([
      ledgerAccountService.list({ includeInactive: filters.includeInactive }),
      ledgerGroupService.list({ includeInactive: filters.includeInactive }),
    ]);
    const groupMap = new Map<string, LedgerGroup>(groups.map((g) => [g.id, g]));
    const incomeByGroup = new Map<string, number>();
    const expenseByGroup = new Map<string, number>();

    for (const ledger of ledgers) {
      if (ledger.isActive === false && !filters.includeInactive) continue;
      const group = groupMap.get(ledger.groupId);
      if (!group || (group.type !== 'INCOME' && group.type !== 'EXPENSE')) continue;

      let net = ledger.openingBalanceType === 'DEBIT' ? ledger.openingBalance : -ledger.openingBalance;
      const txns = await ledgerTransactionService.list({ ledgerId: ledger.id });
      for (const txn of txns) {
        const txnTs = Date.parse(txn.date);
        if (Number.isNaN(txnTs)) continue;
        if (fromTs !== null && txnTs < fromTs) continue;
        if (toTs !== null && txnTs > toTs) continue;
        net += txn.debit - txn.credit;
      }

      if (group.type === 'INCOME') {
        const signed = -net;
        incomeByGroup.set(group.id, round2((incomeByGroup.get(group.id) ?? 0) + signed));
      } else {
        expenseByGroup.set(group.id, round2((expenseByGroup.get(group.id) ?? 0) + net));
      }
    }

    const incomeRows: ProfitAndLossGroupRow[] = Array.from(incomeByGroup.entries())
      .map(([groupId, amount]) => ({
        groupId,
        groupName: groupMap.get(groupId)?.name ?? groupId,
        groupType: 'INCOME' as const,
        amount,
      }))
      .filter((r) => r.amount !== 0)
      .sort((a, b) => a.groupName.localeCompare(b.groupName));

    const expenseRows: ProfitAndLossGroupRow[] = Array.from(expenseByGroup.entries())
      .map(([groupId, amount]) => ({
        groupId,
        groupName: groupMap.get(groupId)?.name ?? groupId,
        groupType: 'EXPENSE' as const,
        amount,
      }))
      .filter((r) => r.amount !== 0)
      .sort((a, b) => a.groupName.localeCompare(b.groupName));

    const totalIncome = round2(incomeRows.reduce((s, r) => s + r.amount, 0));
    const totalExpense = round2(expenseRows.reduce((s, r) => s + r.amount, 0));

    return {
      fromDate: filters.fromDate ?? '',
      toDate: filters.toDate ?? new Date().toISOString().split('T')[0],
      incomeRows,
      expenseRows,
      totalIncome,
      totalExpense,
      netProfit: round2(totalIncome - totalExpense),
    };
  },
};
