import type { LedgerGroup } from '../types/masters';
import { CHART_ROOT_GROUP_IDS } from '../constants/chartOfAccounts';

const ROOT_TYPE_LABEL: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
};

export function buildGroupPath(groupId: string, groups: LedgerGroup[]): string {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const segments: string[] = [];
  let current: string | null | undefined = groupId;
  while (current) {
    const g = byId.get(current);
    if (!g) break;
    segments.unshift(g.name);
    current = g.parentGroupId ?? null;
  }
  return segments.join(' > ');
}

export function rootTypeLabel(groupId: string, groups: LedgerGroup[]): string | null {
  const byId = new Map(groups.map((g) => [g.id, g]));
  let current: string | null | undefined = groupId;
  while (current) {
    const g = byId.get(current);
    if (!g) break;
    if ((CHART_ROOT_GROUP_IDS as readonly string[]).includes(g.id)) {
      return ROOT_TYPE_LABEL[g.type] ?? g.name;
    }
    current = g.parentGroupId ?? null;
  }
  const g = byId.get(groupId);
  return g ? ROOT_TYPE_LABEL[g.type] ?? g.type : null;
}

export function groupMatchesTypeFilter(
  groupId: string,
  typeFilter: 'ALL' | 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE',
  groups: LedgerGroup[]
): boolean {
  if (typeFilter === 'ALL') return true;
  const byId = new Map(groups.map((g) => [g.id, g]));
  let current: string | null | undefined = groupId;
  while (current) {
    const g = byId.get(current);
    if (!g) return false;
    if (g.type === typeFilter) return true;
    current = g.parentGroupId ?? null;
  }
  return false;
}

export function descendantGroupIds(
  rootGroupId: string | 'ALL',
  groups: LedgerGroup[]
): Set<string> | null {
  if (rootGroupId === 'ALL') return null;
  const byParent = new Map<string | null, LedgerGroup[]>();
  for (const g of groups) {
    const key = g.parentGroupId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(g);
    byParent.set(key, list);
  }
  const ids = new Set<string>([rootGroupId]);
  const walk = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      ids.add(child.id);
      walk(child.id);
    }
  };
  walk(rootGroupId);
  return ids;
}
