import { LedgerGroup } from '../../types/masters';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_ledger_groups';

export interface LedgerGroupFilters {
  includeInactive?: boolean;
}

const sortGroups = (groups: LedgerGroup[]) =>
  [...groups].sort((a, b) => {
    const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (order !== 0) return order;
    return a.name.localeCompare(b.name);
  });

const isAncestor = (groups: LedgerGroup[], potentialAncestorId: string, nodeId: string | null | undefined): boolean => {
  let current = nodeId;
  while (current) {
    if (current === potentialAncestorId) return true;
    const parent = groups.find((g) => g.id === current)?.parentGroupId;
    current = parent ?? null;
  }
  return false;
};

const validateGroupPayload = (payload: Partial<LedgerGroup>, isCreate: boolean, existingGroups: LedgerGroup[]) => {
  const name: string | null = sanitizeString(payload.name ?? null);
  if (!name) {
    throw new Error('Group name is required');
  }

  const type: LedgerGroup['type'] | undefined = payload.type;
  if (type !== 'ASSET' && type !== 'LIABILITY' && type !== 'INCOME' && type !== 'EXPENSE') {
    throw new Error('Invalid group type');
  }

  if (!isCreate) {
    if (!payload.id) {
      throw new Error('Group id is required');
    }
  }

  const group: LedgerGroup = {
    id: payload.id ?? generateId('grp'),
    name,
    code: sanitizeString(payload.code ?? null),
    type,
    parentGroupId: sanitizeString(payload.parentGroupId ?? null),
    isSystem: Boolean(payload.isSystem),
    sortOrder: payload.sortOrder ?? null,
    isActive: payload.isActive ?? true,
    createdAt: payload.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  if (group.parentGroupId) {
    if (group.parentGroupId === group.id) {
      throw new Error('Group cannot be its own parent');
    }
    const parent = existingGroups.find((g) => g.id === group.parentGroupId);
    if (!parent) {
      throw new Error('Parent group not found');
    }
    if (parent.isActive === false) {
      throw new Error('Parent group is inactive');
    }
    if (parent.type !== group.type) {
      throw new Error('Parent group must be of the same type');
    }
    if (isAncestor(existingGroups, group.id, parent.parentGroupId)) {
      throw new Error('Circular group hierarchy detected');
    }
  }

  return group;
};

export const ledgerGroupService = {
  async list(filters: LedgerGroupFilters = {}): Promise<LedgerGroup[]> {
    const groups = await readList<LedgerGroup>(STORAGE_KEY);
    const filtered = filters.includeInactive ? groups : groups.filter((g) => g.isActive !== false);
    return sortGroups(filtered);
  },

  async getById(id: string): Promise<LedgerGroup | null> {
    const groups = await readList<LedgerGroup>(STORAGE_KEY);
    return groups.find((g) => g.id === id) ?? null;
  },

  async create(payload: Partial<LedgerGroup>): Promise<LedgerGroup> {
    const groups = await readList<LedgerGroup>(STORAGE_KEY);
    const group = validateGroupPayload(payload, true, groups);
    const dupName: boolean = groups.some((g) => g.name.toLowerCase() === group.name.toLowerCase());
    if (dupName) {
      throw new Error('Group name already exists');
    }
    if (group.code) {
      const dupCode: boolean = groups.some((g) => g.code && g.code.toLowerCase() === group.code!.toLowerCase());
      if (dupCode) {
        throw new Error('Group code already exists');
      }
    }

    groups.push(group);
    await writeList(STORAGE_KEY, groups);
    return group;
  },

  async update(id: string, payload: Partial<LedgerGroup>): Promise<LedgerGroup> {
    const groups = await readList<LedgerGroup>(STORAGE_KEY);
    const index = groups.findIndex((g) => g.id === id);
    if (index < 0) {
      throw new Error('Group not found');
    }
    const current = groups[index];
    if (current.isSystem) {
      throw new Error('System groups cannot be edited');
    }

    const updated = validateGroupPayload({ ...current, ...payload, id: current.id, createdAt: current.createdAt }, false, groups);
    const dupName: boolean = groups.some((g, idx) => idx !== index && g.name.toLowerCase() === updated.name.toLowerCase());
    if (dupName) {
      throw new Error('Group name already exists');
    }
    if (updated.code) {
      const dupCode: boolean = groups.some(
        (g, idx) => idx !== index && g.code && g.code.toLowerCase() === updated.code!.toLowerCase()
      );
      if (dupCode) {
        throw new Error('Group code already exists');
      }
    }

    groups[index] = updated;
    await writeList(STORAGE_KEY, groups);
    return updated;
  },

  async softDelete(id: string): Promise<void> {
    const groups = await readList<LedgerGroup>(STORAGE_KEY);
    const index = groups.findIndex((g) => g.id === id);
    if (index < 0) {
      throw new Error('Group not found');
    }
    const current = groups[index];
    if (current.isSystem) {
      throw new Error('System groups cannot be deleted');
    }

    groups[index] = { ...current, isActive: false, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, groups);
  },

  async restore(id: string): Promise<void> {
    const groups = await readList<LedgerGroup>(STORAGE_KEY);
    const index = groups.findIndex((g) => g.id === id);
    if (index < 0) {
      throw new Error('Group not found');
    }

    groups[index] = { ...groups[index], isActive: true, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, groups);
  },

  async seed(initialGroups: LedgerGroup[]) {
    if (!Array.isArray(initialGroups) || initialGroups.length === 0) {
      return;
    }

    const groups = await readList<LedgerGroup>(STORAGE_KEY);
    const now = nowIso();
    let changed = false;

    for (const group of initialGroups) {
      const exists = groups.some((g) => g.id === group.id);
      if (exists) continue;

      groups.push({
        ...group,
        code: group.code ?? null,
        parentGroupId: group.parentGroupId ?? null,
        isSystem: true,
        isActive: true,
        createdAt: group.createdAt ?? now,
        updatedAt: group.updatedAt ?? now,
      });
      changed = true;
    }

    if (changed) {
      await writeList(STORAGE_KEY, sortGroups(groups));
    }
  },
};
