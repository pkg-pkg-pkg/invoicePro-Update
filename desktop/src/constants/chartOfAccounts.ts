import type { LedgerAccount, LedgerGroup, LedgerGroupType } from '../types/masters';

/** Primary chart roots — Assets, Liabilities, Income, Expense. */
export const CHART_ROOT_GROUP_IDS = [
  'grp-assets',
  'grp-liabilities',
  'grp-income',
  'grp-expense',
] as const;

/** Standard sub-groups required by accounting policy (seeded in seedMasters). */
export const STANDARD_SUBGROUP_IDS = {
  cashInHand: 'grp-cash-in-hand',
  bankAccounts: 'grp-bank-accounts',
  sundryDebtors: 'grp-sundry-debtors',
  stockInHand: 'grp-stock-in-hand',
  advances: 'grp-loans-advances',
  sundryCreditors: 'grp-sundry-creditors',
  loans: 'grp-secured-loans',
  dutiesTaxes: 'grp-duties-taxes',
  salesAccounts: 'grp-sales-accounts',
  directIncome: 'grp-direct-income',
  indirectIncome: 'grp-indirect-income',
  purchaseAccounts: 'grp-purchase-accounts',
  directExpenses: 'grp-direct-expenses',
  indirectExpenses: 'grp-indirect-expenses',
} as const;

/** Legacy flat group — migrate ledgers to cash-in-hand or bank-accounts. */
export const LEGACY_CASH_BANK_GROUP_ID = 'grp-cash-bank';

/** Leaf groups where ledger accounts may be posted (not structural parents). */
export const ASSIGNABLE_LEDGER_GROUP_IDS = new Set<string>([
  STANDARD_SUBGROUP_IDS.cashInHand,
  STANDARD_SUBGROUP_IDS.bankAccounts,
  STANDARD_SUBGROUP_IDS.sundryDebtors,
  STANDARD_SUBGROUP_IDS.stockInHand,
  STANDARD_SUBGROUP_IDS.advances,
  'grp-prepaid-expenses',
  'grp-fixed-assets',
  'grp-investments',
  'grp-suspense-account',
  STANDARD_SUBGROUP_IDS.sundryCreditors,
  STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'grp-provisions',
  'grp-bank-overdraft',
  STANDARD_SUBGROUP_IDS.loans,
  'grp-unsecured-loans',
  'grp-capital-account',
  'grp-reserves-surplus',
  STANDARD_SUBGROUP_IDS.salesAccounts,
  'grp-service-income',
  'grp-other-income',
  STANDARD_SUBGROUP_IDS.indirectIncome,
  STANDARD_SUBGROUP_IDS.purchaseAccounts,
  'grp-cogs',
  STANDARD_SUBGROUP_IDS.indirectExpenses,
  'grp-admin-expenses',
  'grp-selling-distribution',
  'grp-finance-charges',
  'grp-depreciation',
  LEGACY_CASH_BANK_GROUP_ID,
]);

export type LedgerClassificationRole =
  | 'customer'
  | 'supplier'
  | 'bank'
  | 'cash'
  | 'sales'
  | 'purchase'
  | 'expense'
  | 'gst'
  | 'stock'
  | 'loan'
  | 'capital'
  | 'unknown';

export const ROLE_TO_EXPECTED_GROUP: Record<LedgerClassificationRole, string> = {
  customer: STANDARD_SUBGROUP_IDS.sundryDebtors,
  supplier: STANDARD_SUBGROUP_IDS.sundryCreditors,
  bank: STANDARD_SUBGROUP_IDS.bankAccounts,
  cash: STANDARD_SUBGROUP_IDS.cashInHand,
  sales: STANDARD_SUBGROUP_IDS.salesAccounts,
  purchase: STANDARD_SUBGROUP_IDS.purchaseAccounts,
  expense: STANDARD_SUBGROUP_IDS.indirectExpenses,
  gst: STANDARD_SUBGROUP_IDS.dutiesTaxes,
  stock: STANDARD_SUBGROUP_IDS.stockInHand,
  loan: STANDARD_SUBGROUP_IDS.loans,
  capital: 'grp-capital-account',
  unknown: '',
};

/** System ledger ids auto-created by autoLedgerService. */
export const SYSTEM_LEDGER_IDS = new Set<string>([
  'led-cash',
  'led-sales',
  'led-purchase',
  'led-purchase-returns',
  'led-sales-returns',
  'led-gst-taxes',
  'led-cgst-output',
  'led-sgst-output',
  'led-igst-output',
  'led-cgst-input',
  'led-sgst-input',
  'led-igst-input',
  'led-round-off',
]);

const EXPENSE_SUBTREE = new Set<string>([
  STANDARD_SUBGROUP_IDS.purchaseAccounts,
  STANDARD_SUBGROUP_IDS.directExpenses,
  STANDARD_SUBGROUP_IDS.indirectExpenses,
  'grp-cogs',
  'grp-admin-expenses',
  'grp-selling-distribution',
  'grp-finance-charges',
  'grp-depreciation',
]);

const INCOME_SUBTREE = new Set<string>([
  STANDARD_SUBGROUP_IDS.salesAccounts,
  STANDARD_SUBGROUP_IDS.directIncome,
  STANDARD_SUBGROUP_IDS.indirectIncome,
  'grp-service-income',
  'grp-other-income',
]);

const ASSET_SUBTREE = new Set<string>([
  STANDARD_SUBGROUP_IDS.cashInHand,
  STANDARD_SUBGROUP_IDS.bankAccounts,
  STANDARD_SUBGROUP_IDS.sundryDebtors,
  STANDARD_SUBGROUP_IDS.stockInHand,
  STANDARD_SUBGROUP_IDS.advances,
  'grp-prepaid-expenses',
  'grp-fixed-assets',
  'grp-investments',
  'grp-suspense-account',
  'grp-current-assets',
  LEGACY_CASH_BANK_GROUP_ID,
]);

const LIABILITY_SUBTREE = new Set<string>([
  STANDARD_SUBGROUP_IDS.sundryCreditors,
  STANDARD_SUBGROUP_IDS.dutiesTaxes,
  STANDARD_SUBGROUP_IDS.loans,
  'grp-unsecured-loans',
  'grp-provisions',
  'grp-bank-overdraft',
  'grp-capital-account',
  'grp-reserves-surplus',
  'grp-current-liabilities',
]);

export function groupTypeForId(groupId: string, groupMap: Map<string, LedgerGroup>): LedgerGroupType | null {
  let current: string | null | undefined = groupId;
  while (current) {
    const g = groupMap.get(current);
    if (g?.type) return g.type;
    current = g?.parentGroupId;
  }
  return null;
}

export function isStructuralParentGroup(groupId: string): boolean {
  return CHART_ROOT_GROUP_IDS.includes(groupId as (typeof CHART_ROOT_GROUP_IDS)[number])
    || groupId === 'grp-current-assets'
    || groupId === 'grp-current-liabilities'
    || groupId === 'grp-loans'
    || groupId === STANDARD_SUBGROUP_IDS.directIncome
    || groupId === STANDARD_SUBGROUP_IDS.indirectIncome
    || groupId === STANDARD_SUBGROUP_IDS.directExpenses
    || groupId === STANDARD_SUBGROUP_IDS.indirectExpenses;
}

/** Ledgers must sit in leaf assignable groups, not structural parents. */
export function assertAssignableLedgerGroup(group: LedgerGroup): void {
  if (isStructuralParentGroup(group.id)) {
    throw new Error(`Ledgers cannot be placed under structural group "${group.name}". Choose a sub-group.`);
  }
  if (!ASSIGNABLE_LEDGER_GROUP_IDS.has(group.id)) {
    throw new Error(`Group "${group.name}" is not configured for ledger posting. Choose a standard sub-group.`);
  }
}

/** Expense ledgers cannot sit under Assets, etc. */
export function assertLedgerTypeMatchesGroup(
  ledger: Pick<LedgerAccount, 'isCashBank' | 'groupId'>,
  group: LedgerGroup,
  inferredRole?: LedgerClassificationRole
): void {
  assertAssignableLedgerGroup(group);

  if (ledger.isCashBank && group.type !== 'ASSET') {
    throw new Error('Cash/Bank ledgers must belong to an Asset group.');
  }

  const role = inferredRole ?? 'unknown';
  if (role === 'expense' && group.type !== 'EXPENSE') {
    throw new Error('Expense ledgers must belong to an Expense group.');
  }
  if (role === 'sales' && group.type !== 'INCOME') {
    throw new Error('Sales ledgers must belong to an Income group.');
  }
  if (role === 'purchase' && group.type !== 'EXPENSE') {
    throw new Error('Purchase ledgers must belong to an Expense group.');
  }
  if ((role === 'customer' || role === 'cash' || role === 'bank') && group.type !== 'ASSET') {
    throw new Error(`${role} ledgers must belong to an Asset group.`);
  }
  if (role === 'supplier' && group.type !== 'LIABILITY') {
    throw new Error('Creditor ledgers must belong to a Liability group.');
  }
  if (role === 'gst' && group.type !== 'LIABILITY') {
    throw new Error('GST/Duties ledgers must belong to a Liability group.');
  }

  if (EXPENSE_SUBTREE.has(ledger.groupId) && group.type === 'ASSET') {
    throw new Error('Expense ledgers cannot be under Assets.');
  }
  if (INCOME_SUBTREE.has(ledger.groupId) && group.type === 'EXPENSE') {
    throw new Error('Income ledgers cannot be under Expenses.');
  }
  if (ASSET_SUBTREE.has(ledger.groupId) && group.type === 'EXPENSE' && role !== 'purchase') {
    throw new Error('Asset ledgers cannot be reclassified under Expenses.');
  }
  if (LIABILITY_SUBTREE.has(ledger.groupId) && group.type === 'INCOME') {
    throw new Error('Liability ledgers cannot be under Income.');
  }
}

export function resolveLegacyCashBankTarget(ledger: LedgerAccount): string {
  const b = ledger.bankDetails;
  const hasBank =
    Boolean(b?.accountNumber?.trim()) ||
    Boolean(b?.ifscCode?.trim()) ||
    Boolean(b?.bankName?.trim()) ||
    ledger.groupId === STANDARD_SUBGROUP_IDS.bankAccounts;
  return hasBank ? STANDARD_SUBGROUP_IDS.bankAccounts : STANDARD_SUBGROUP_IDS.cashInHand;
}
