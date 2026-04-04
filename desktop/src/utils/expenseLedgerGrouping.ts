import type { LedgerAccount } from '../types/masters';

export type GroupLite = { type: string; parentGroupId?: string | null };

/** Walk up group hierarchy; detect cycles. True if any ancestor (or self) is matching type. */
export function ledgerTouchesTree(groupId: string, groupById: Map<string, GroupLite>, type: string): boolean {
  const seen = new Set<string>();
  let gid: string | null | undefined = groupId;
  let depth = 0;
  const max = 64;
  while (gid && depth < max) {
    if (seen.has(gid)) return false;
    seen.add(gid);
    depth += 1;
    const g = groupById.get(gid);
    if (!g) return false;
    if (g.type === type) return true;
    gid = g.parentGroupId ?? null;
  }
  return false;
}

export function ledgerTouchesExpenseTree(groupId: string, groupById: Map<string, GroupLite>): boolean {
  return ledgerTouchesTree(groupId, groupById, 'EXPENSE');
}

export function ledgerTouchesIncomeTree(groupId: string, groupById: Map<string, GroupLite>): boolean {
  return ledgerTouchesTree(groupId, groupById, 'INCOME');
}

export function particularRole(
  ledger: LedgerAccount,
  groupById: Map<string, GroupLite>
): 'Customer' | 'Supplier' | 'Expense' | 'Bank' | 'Income' | 'Asset' | 'Liability' {
  if (ledger.groupId === 'grp-sundry-debtors') return 'Customer';
  if (ledger.groupId === 'grp-sundry-creditors') return 'Supplier';
  if (ledger.isCashBank) return 'Bank';
  if (ledgerTouchesExpenseTree(ledger.groupId, groupById)) return 'Expense';
  if (ledgerTouchesIncomeTree(ledger.groupId, groupById)) return 'Income';
  
  const g = groupById.get(ledger.groupId);
  if (g?.type === 'ASSET') return 'Asset';
  if (g?.type === 'LIABILITY') return 'Liability';
  
  return 'Expense';
}
