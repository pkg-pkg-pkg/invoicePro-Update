import type { LedgerAccount } from '../../types/masters';
import {
  LEGACY_CASH_BANK_GROUP_ID,
  ROLE_TO_EXPECTED_GROUP,
  SYSTEM_LEDGER_IDS,
  STANDARD_SUBGROUP_IDS,
  type LedgerClassificationRole,
  resolveLegacyCashBankTarget,
} from '../../constants/chartOfAccounts';

const SYSTEM_LEDGER_GROUP: Record<string, string> = {
  'led-cash': STANDARD_SUBGROUP_IDS.cashInHand,
  'led-sales': STANDARD_SUBGROUP_IDS.salesAccounts,
  'led-sales-returns': STANDARD_SUBGROUP_IDS.salesAccounts,
  'led-purchase': STANDARD_SUBGROUP_IDS.purchaseAccounts,
  'led-purchase-returns': STANDARD_SUBGROUP_IDS.purchaseAccounts,
  'led-gst-taxes': STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'led-cgst-output': STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'led-sgst-output': STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'led-igst-output': STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'led-cgst-input': STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'led-sgst-input': STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'led-igst-input': STANDARD_SUBGROUP_IDS.dutiesTaxes,
  'led-round-off': STANDARD_SUBGROUP_IDS.dutiesTaxes,
};

function normalizeName(name: string): string {
  return String(name ?? '').trim().toLowerCase();
}

function inferRoleFromGroup(groupId: string): LedgerClassificationRole {
  if (groupId === STANDARD_SUBGROUP_IDS.sundryDebtors) return 'customer';
  if (groupId === STANDARD_SUBGROUP_IDS.sundryCreditors) return 'supplier';
  if (groupId === STANDARD_SUBGROUP_IDS.bankAccounts || groupId === LEGACY_CASH_BANK_GROUP_ID) return 'bank';
  if (groupId === STANDARD_SUBGROUP_IDS.cashInHand) return 'cash';
  if (groupId === STANDARD_SUBGROUP_IDS.salesAccounts || groupId === 'grp-service-income') return 'sales';
  if (groupId === STANDARD_SUBGROUP_IDS.purchaseAccounts || groupId === 'grp-cogs') return 'purchase';
  if (groupId === STANDARD_SUBGROUP_IDS.dutiesTaxes) return 'gst';
  if (
    groupId === STANDARD_SUBGROUP_IDS.indirectExpenses ||
    groupId === 'grp-admin-expenses' ||
    groupId === 'grp-selling-distribution' ||
    groupId === 'grp-finance-charges' ||
    groupId === 'grp-depreciation'
  ) {
    return 'expense';
  }
  if (groupId === STANDARD_SUBGROUP_IDS.stockInHand) return 'stock';
  if (groupId === STANDARD_SUBGROUP_IDS.loans || groupId === 'grp-unsecured-loans') return 'loan';
  if (groupId === 'grp-capital-account') return 'capital';
  return 'unknown';
}

export function inferLedgerRole(
  ledger: LedgerAccount,
  partyLinks: Map<string, 'customer' | 'supplier'>
): LedgerClassificationRole {
  if (SYSTEM_LEDGER_IDS.has(ledger.id)) {
    if (ledger.id === 'led-cash') return 'cash';
    if (ledger.id.startsWith('led-sales')) return 'sales';
    if (ledger.id.startsWith('led-purchase')) return 'purchase';
    if (
      ledger.id.includes('gst') ||
      ledger.id.includes('cgst') ||
      ledger.id.includes('sgst') ||
      ledger.id.includes('igst') ||
      ledger.id === 'led-round-off'
    ) {
      return 'gst';
    }
  }

  const partyKind = partyLinks.get(ledger.id);
  if (partyKind === 'customer') return 'customer';
  if (partyKind === 'supplier') return 'supplier';

  if (ledger.isCashBank) {
    const b = ledger.bankDetails;
    const hasBank =
      Boolean(b?.accountNumber?.trim()) ||
      Boolean(b?.ifscCode?.trim()) ||
      Boolean(b?.bankName?.trim()) ||
      ledger.groupId === STANDARD_SUBGROUP_IDS.bankAccounts;
    return hasBank ? 'bank' : 'cash';
  }

  const name = normalizeName(ledger.name);
  if (name.includes('sales') || name.includes('revenue')) return 'sales';
  if (name.includes('purchase') || name.includes('cogs')) return 'purchase';
  if (name.includes('gst') || name.includes('cgst') || name.includes('sgst') || name.includes('igst')) return 'gst';
  if (name === 'cash' || name.includes('petty cash')) return 'cash';

  return inferRoleFromGroup(ledger.groupId);
}

export function expectedGroupForLedger(ledger: LedgerAccount, role: LedgerClassificationRole): string {
  if (ledger.groupId === LEGACY_CASH_BANK_GROUP_ID) {
    return resolveLegacyCashBankTarget(ledger);
  }
  if (SYSTEM_LEDGER_GROUP[ledger.id]) {
    return SYSTEM_LEDGER_GROUP[ledger.id];
  }
  const mapped = ROLE_TO_EXPECTED_GROUP[role];
  if (mapped) return mapped;
  return ledger.groupId;
}

export type { LedgerClassificationRole };
