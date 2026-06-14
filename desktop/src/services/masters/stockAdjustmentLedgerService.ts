import { STANDARD_SUBGROUP_IDS } from '../../constants/chartOfAccounts';
import type { LedgerAccount, LedgerBalanceType } from '../../types/masters';
import { ledgerAccountService } from './ledgerAccountService';
import { nowIso } from './storageHelpers';

/** System ledger ids for stock adjustment postings. */
export const STOCK_ADJ_LEDGER_IDS = {
  stockAsset: 'led-stock-in-hand',
  adjustmentGain: 'led-stock-adj-gain',
  lossTheft: 'led-loss-theft',
  stockDamage: 'led-stock-damage',
  stockShortage: 'led-stock-shortage',
  samplesInternal: 'led-samples-internal',
  adjustmentExpense: 'led-stock-adj-expense',
} as const;

type LedgerSeed = {
  id: string;
  name: string;
  groupId: string;
  openingBalanceType: LedgerBalanceType;
};

const LEDGER_SEEDS: LedgerSeed[] = [
  {
    id: STOCK_ADJ_LEDGER_IDS.stockAsset,
    name: 'Inventory / Stock Asset',
    groupId: STANDARD_SUBGROUP_IDS.stockInHand,
    openingBalanceType: 'DEBIT',
  },
  {
    id: STOCK_ADJ_LEDGER_IDS.adjustmentGain,
    name: 'Stock Adjustment Gain',
    groupId: STANDARD_SUBGROUP_IDS.indirectIncome,
    openingBalanceType: 'CREDIT',
  },
  {
    id: STOCK_ADJ_LEDGER_IDS.lossTheft,
    name: 'Loss by Theft',
    groupId: STANDARD_SUBGROUP_IDS.indirectExpenses,
    openingBalanceType: 'DEBIT',
  },
  {
    id: STOCK_ADJ_LEDGER_IDS.stockDamage,
    name: 'Stock Damage / Spoilage',
    groupId: STANDARD_SUBGROUP_IDS.indirectExpenses,
    openingBalanceType: 'DEBIT',
  },
  {
    id: STOCK_ADJ_LEDGER_IDS.stockShortage,
    name: 'Stock Shortage',
    groupId: STANDARD_SUBGROUP_IDS.indirectExpenses,
    openingBalanceType: 'DEBIT',
  },
  {
    id: STOCK_ADJ_LEDGER_IDS.samplesInternal,
    name: 'Samples / Internal Consumption',
    groupId: STANDARD_SUBGROUP_IDS.indirectExpenses,
    openingBalanceType: 'DEBIT',
  },
  {
    id: STOCK_ADJ_LEDGER_IDS.adjustmentExpense,
    name: 'Stock Adjustment Expense',
    groupId: STANDARD_SUBGROUP_IDS.indirectExpenses,
    openingBalanceType: 'DEBIT',
  },
];

async function ensureLedger(seed: LedgerSeed): Promise<LedgerAccount> {
  const existing = await ledgerAccountService.getById(seed.id);
  if (existing) return existing;

  const now = nowIso();
  return ledgerAccountService.create({
    id: seed.id,
    name: seed.name,
    groupId: seed.groupId,
    openingBalance: 0,
    openingBalanceType: seed.openingBalanceType,
    currentBalance: 0,
    isActive: true,
    isCashBank: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function ensureStockAdjustmentLedgers(): Promise<Record<keyof typeof STOCK_ADJ_LEDGER_IDS, string>> {
  await Promise.all(LEDGER_SEEDS.map((seed) => ensureLedger(seed)));
  return { ...STOCK_ADJ_LEDGER_IDS };
}
