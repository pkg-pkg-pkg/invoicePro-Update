import { ledgerGroupService } from './ledgerGroupService';
import { LedgerGroupType } from '../../types/masters';

type GroupSeed = {
  id: string;
  name: string;
  type: LedgerGroupType;
  sortOrder: number;
  parentGroupId?: string | null;
};

const createGroup = (
  id: string,
  name: string,
  type: LedgerGroupType,
  sortOrder: number,
  parentGroupId: string | null = null
): GroupSeed => ({
  id,
  name,
  type,
  sortOrder,
  parentGroupId,
});

const LEDGER_GROUPS: GroupSeed[] = [
  // Root categories
  createGroup('grp-assets', 'Assets', 'ASSET', 1),
  createGroup('grp-liabilities', 'Liabilities', 'LIABILITY', 2),
  createGroup('grp-income', 'Income', 'INCOME', 3),
  createGroup('grp-expense', 'Expense', 'EXPENSE', 4),

  // Asset hierarchy
  createGroup('grp-fixed-assets', 'Fixed Assets', 'ASSET', 10, 'grp-assets'),
  createGroup('grp-current-assets', 'Current Assets', 'ASSET', 11, 'grp-assets'),
  createGroup('grp-investments', 'Investments', 'ASSET', 12, 'grp-assets'),
  createGroup('grp-loans-advances', 'Loans & Advances (Assets)', 'ASSET', 13, 'grp-assets'),
  createGroup('grp-suspense-account', 'Suspense Account', 'ASSET', 14, 'grp-assets'),
  createGroup('grp-bank-accounts', 'Bank Accounts', 'ASSET', 20, 'grp-current-assets'),
  createGroup('grp-cash-in-hand', 'Cash-in-Hand', 'ASSET', 21, 'grp-current-assets'),
  createGroup('grp-sundry-debtors', 'Sundry Debtors', 'ASSET', 22, 'grp-current-assets'),
  createGroup('grp-stock-in-hand', 'Stock-in-Hand', 'ASSET', 23, 'grp-current-assets'),
  createGroup('grp-prepaid-expenses', 'Prepaid Expenses', 'ASSET', 24, 'grp-current-assets'),

  // Liability hierarchy
  createGroup('grp-capital-account', 'Capital Account', 'LIABILITY', 30, 'grp-liabilities'),
  createGroup('grp-reserves-surplus', 'Reserves & Surplus', 'LIABILITY', 31, 'grp-liabilities'),
  createGroup('grp-current-liabilities', 'Current Liabilities', 'LIABILITY', 32, 'grp-liabilities'),
  createGroup('grp-secured-loans', 'Secured Loans', 'LIABILITY', 33, 'grp-liabilities'),
  createGroup('grp-unsecured-loans', 'Unsecured Loans', 'LIABILITY', 34, 'grp-liabilities'),
  createGroup('grp-sundry-creditors', 'Sundry Creditors', 'LIABILITY', 40, 'grp-current-liabilities'),
  createGroup('grp-duties-taxes', 'Duties & Taxes', 'LIABILITY', 41, 'grp-current-liabilities'),
  createGroup('grp-provisions', 'Provisions', 'LIABILITY', 42, 'grp-current-liabilities'),
  createGroup('grp-bank-overdraft', 'Bank Overdraft', 'LIABILITY', 43, 'grp-current-liabilities'),

  // Income hierarchy
  createGroup('grp-direct-income', 'Direct Income', 'INCOME', 50, 'grp-income'),
  createGroup('grp-indirect-income', 'Indirect Income', 'INCOME', 51, 'grp-income'),
  createGroup('grp-sales-accounts', 'Sales Accounts', 'INCOME', 52, 'grp-direct-income'),
  createGroup('grp-service-income', 'Service Income', 'INCOME', 53, 'grp-direct-income'),
  createGroup('grp-other-income', 'Other Income', 'INCOME', 54, 'grp-indirect-income'),

  // Expense hierarchy
  createGroup('grp-direct-expenses', 'Direct Expenses', 'EXPENSE', 60, 'grp-expense'),
  createGroup('grp-indirect-expenses', 'Indirect Expenses', 'EXPENSE', 61, 'grp-expense'),
  createGroup('grp-purchase-accounts', 'Purchase Accounts', 'EXPENSE', 62, 'grp-direct-expenses'),
  createGroup('grp-cogs', 'Cost of Goods Sold', 'EXPENSE', 63, 'grp-direct-expenses'),
  createGroup('grp-admin-expenses', 'Administrative Expenses', 'EXPENSE', 64, 'grp-indirect-expenses'),
  createGroup('grp-selling-distribution', 'Selling & Distribution Expenses', 'EXPENSE', 65, 'grp-indirect-expenses'),
  createGroup('grp-finance-charges', 'Finance Charges', 'EXPENSE', 66, 'grp-indirect-expenses'),
  createGroup('grp-depreciation', 'Depreciation', 'EXPENSE', 67, 'grp-indirect-expenses'),
];

export const seedLedgerGroups = async () => {
  const timestamp = new Date().toISOString();
  await ledgerGroupService.seed(
    LEDGER_GROUPS.map((group) => ({
      ...group,
      code: null,
      parentGroupId: group.parentGroupId ?? null,
      isSystem: true,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
  );
};

export const initMasters = async () => {
  await seedLedgerGroups();
  const { migrateLegacySystemCashLedger } = await import('./autoLedgerService');
  await migrateLegacySystemCashLedger();
};
