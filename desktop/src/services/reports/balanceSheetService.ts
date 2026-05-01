import { LedgerAccount, LedgerGroup } from '../../types/masters';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerGroupService } from '../masters/ledgerGroupService';
import { ledgerTransactionService } from '../masters/ledgerTransactionService';

export interface BalanceSheetFilters {
  asOfDate?: string;
  includeInactive?: boolean;
}

export interface BalanceSheetRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  amount: number;
  previousAmount: number;
}

export interface BalanceSheetResult {
  asOfDate: string;
  previousAsOfDate: string;
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  totalAssets: number;
  previousTotalAssets: number;
  totalLiabilities: number;
  previousTotalLiabilities: number;
  profitOrLoss: number;
  previousProfitOrLoss: number;
  balanced: boolean;
}

const parseDateOrThrow = (value?: string): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    throw new Error('Invalid date provided');
  }
  return ts;
};

const toSignedOpening = (ledger: LedgerAccount) =>
  ledger.openingBalanceType === 'DEBIT' ? ledger.openingBalance : -ledger.openingBalance;

const round2 = (value: number) => Number(value.toFixed(2));

const computeSignedClosing = async (ledger: LedgerAccount, asOfTs: number | null) => {
  let closing = toSignedOpening(ledger);
  const txns = await ledgerTransactionService.list({ ledgerId: ledger.id });
  for (const txn of txns) {
    const txnTs = Date.parse(txn.date);
    if (Number.isNaN(txnTs)) continue;
    if (asOfTs !== null && txnTs > asOfTs) continue;
    closing += txn.debit - txn.credit;
  }
  return round2(closing);
};

export const balanceSheetService = {
  async getBalanceSheet(filters: BalanceSheetFilters = {}): Promise<BalanceSheetResult> {
    const asOfTs = parseDateOrThrow(filters.asOfDate);
    const asOfDate = filters.asOfDate || new Date().toISOString().split('T')[0];
    const prevDateObj = new Date(asOfDate);
    prevDateObj.setFullYear(prevDateObj.getFullYear() - 1);
    const previousAsOfDate = prevDateObj.toISOString().split('T')[0];
    const previousAsOfTs = parseDateOrThrow(previousAsOfDate);
    const [ledgers, groups] = await Promise.all([
      ledgerAccountService.list({ includeInactive: filters.includeInactive }),
      ledgerGroupService.list({ includeInactive: filters.includeInactive }),
    ]);
    const groupMap = new Map<string, LedgerGroup>(groups.map((g) => [g.id, g]));

    const buildSnapshot = async (targetTs: number | null) => {
      const assets: Omit<BalanceSheetRow, 'previousAmount'>[] = [];
      const liabilities: Omit<BalanceSheetRow, 'previousAmount'>[] = [];
      let incomeNet = 0;
      let expenseNet = 0;

      for (const ledger of ledgers) {
        if (ledger.isActive === false && !filters.includeInactive) continue;
        const group = groupMap.get(ledger.groupId);
        if (!group) continue;
        const signedClosing = await computeSignedClosing(ledger, targetTs);
        if (signedClosing === 0) continue;

        const pushAsset = (amount: number) =>
          assets.push({
            ledgerId: ledger.id,
            ledgerName: ledger.name,
            groupName: group.name,
            amount: round2(Math.abs(amount)),
          });
        const pushLiability = (amount: number) =>
          liabilities.push({
            ledgerId: ledger.id,
            ledgerName: ledger.name,
            groupName: group.name,
            amount: round2(Math.abs(amount)),
          });

        switch (group.type) {
          case 'ASSET':
            if (signedClosing > 0) pushAsset(signedClosing);
            else pushLiability(signedClosing);
            break;
          case 'LIABILITY':
            if (signedClosing < 0) pushLiability(signedClosing);
            else pushAsset(signedClosing);
            break;
          case 'INCOME':
            incomeNet += -signedClosing;
            break;
          case 'EXPENSE':
            expenseNet += signedClosing;
            break;
          default:
            break;
        }
      }

      const profitOrLoss = round2(incomeNet - expenseNet);
      if (profitOrLoss > 0) {
        liabilities.push({
          ledgerId: 'profit-current-period',
          ledgerName: 'Current Period Profit',
          groupName: 'Profit & Loss',
          amount: round2(profitOrLoss),
        });
      } else if (profitOrLoss < 0) {
        assets.push({
          ledgerId: 'loss-current-period',
          ledgerName: 'Current Period Loss',
          groupName: 'Profit & Loss',
          amount: round2(Math.abs(profitOrLoss)),
        });
      }

      const totalAssets = round2(assets.reduce((sum, row) => sum + row.amount, 0));
      const totalLiabilities = round2(liabilities.reduce((sum, row) => sum + row.amount, 0));

      return {
        assets: assets.sort((a, b) => a.groupName.localeCompare(b.groupName) || a.ledgerName.localeCompare(b.ledgerName)),
        liabilities: liabilities.sort((a, b) => a.groupName.localeCompare(b.groupName) || a.ledgerName.localeCompare(b.ledgerName)),
        totalAssets,
        totalLiabilities,
        profitOrLoss,
      };
    };

    const [current, previous] = await Promise.all([buildSnapshot(asOfTs), buildSnapshot(previousAsOfTs)]);
    const mergeRows = (
      currentRows: Omit<BalanceSheetRow, 'previousAmount'>[],
      previousRows: Omit<BalanceSheetRow, 'previousAmount'>[]
    ): BalanceSheetRow[] => {
      const previousMap = new Map(previousRows.map((r) => [r.ledgerId, r]));
      const currentMap = new Map(currentRows.map((r) => [r.ledgerId, r]));
      const ids = new Set<string>([...currentMap.keys(), ...previousMap.keys()]);
      return Array.from(ids)
        .map((id) => {
          const cur = currentMap.get(id);
          const prev = previousMap.get(id);
          return {
            ledgerId: id,
            ledgerName: cur?.ledgerName ?? prev?.ledgerName ?? id,
            groupName: cur?.groupName ?? prev?.groupName ?? 'Other',
            amount: round2(cur?.amount ?? 0),
            previousAmount: round2(prev?.amount ?? 0),
          };
        })
        .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.ledgerName.localeCompare(b.ledgerName));
    };

    const assets = mergeRows(current.assets, previous.assets);
    const liabilities = mergeRows(current.liabilities, previous.liabilities);
    const balanced = current.totalAssets === current.totalLiabilities;

    return {
      asOfDate,
      previousAsOfDate,
      assets,
      liabilities,
      totalAssets: current.totalAssets,
      previousTotalAssets: previous.totalAssets,
      totalLiabilities: current.totalLiabilities,
      previousTotalLiabilities: previous.totalLiabilities,
      profitOrLoss: current.profitOrLoss,
      previousProfitOrLoss: previous.profitOrLoss,
      balanced,
    };
  },
};

