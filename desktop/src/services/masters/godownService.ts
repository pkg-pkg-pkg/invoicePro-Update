import { Godown } from '../../types/masters';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_godowns';

export interface GodownFilters {
  includeInactive?: boolean;
  search?: string;
}

const ensureUniqueGodown = (godowns: Godown[], candidate: Godown, skipIndex?: number) => {
  const dupName = godowns.some(
    (godown, index) => index !== skipIndex && godown.name.toLowerCase() === candidate.name.toLowerCase()
  );
  if (dupName) {
    throw new Error('Godown name already exists');
  }

  if (candidate.code) {
    const dupCode = godowns.some(
      (godown, index) =>
        index !== skipIndex && godown.code && godown.code.toLowerCase() === candidate.code!.toLowerCase()
    );
    if (dupCode) {
      throw new Error('Godown code already exists');
    }
  }
};

const buildGodown = (payload: Partial<Godown>, isCreate: boolean): Godown => {
  const name = sanitizeString(payload.name ?? null);
  if (!name) {
    throw new Error('Godown name is required');
  }

  if (!isCreate && !payload.id) {
    throw new Error('Godown id is required');
  }

  const code = sanitizeString(payload.code ?? null);
  const address = sanitizeString(payload.address ?? null);

  return {
    id: payload.id ?? generateId('gdn'),
    name,
    code,
    address,
    isDefault: payload.isDefault ?? false,
    isActive: payload.isActive ?? true,
    createdAt: payload.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
};

const filterGodowns = (godowns: Godown[], filters: GodownFilters) => {
  const searchValue = sanitizeString(filters.search ?? null)?.toLowerCase();
  return godowns.filter((godown) => {
    if (!filters.includeInactive && godown.isActive === false) {
      return false;
    }
    if (searchValue) {
      const haystack = `${godown.name} ${godown.code ?? ''} ${godown.address ?? ''}`.toLowerCase();
      if (!haystack.includes(searchValue)) {
        return false;
      }
    }
    return true;
  });
};

const ensureSingleDefault = (godowns: Godown[], newDefaultId: string) => {
  godowns.forEach((gdn) => {
    if (gdn.id !== newDefaultId && gdn.isDefault) {
      gdn.isDefault = false;
      gdn.updatedAt = nowIso();
    }
  });
};

const ensureDefaultExists = (godowns: Godown[]) => {
  if (!godowns.some((gdn) => gdn.isDefault && gdn.isActive !== false)) {
    throw new Error('At least one active default godown is required');
  }
};

export const godownService = {
  async list(filters: GodownFilters = {}): Promise<Godown[]> {
    const godowns = await readList<Godown>(STORAGE_KEY);
    return filterGodowns(godowns, filters).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: string): Promise<Godown | null> {
    const godowns = await readList<Godown>(STORAGE_KEY);
    return godowns.find((gdn) => gdn.id === id) ?? null;
  },

  async create(payload: Partial<Godown>): Promise<Godown> {
    const godowns = await readList<Godown>(STORAGE_KEY);
    const godown = buildGodown(payload, true);

    ensureUniqueGodown(godowns, godown);

    if (!godowns.some((g) => g.isDefault) && !godown.isDefault) {
      godown.isDefault = true;
    } else if (godown.isDefault) {
      ensureSingleDefault(godowns, godown.id);
    }

    godowns.push(godown);
    await writeList(STORAGE_KEY, godowns);
    return godown;
  },

  async update(id: string, payload: Partial<Godown>): Promise<Godown> {
    const godowns = await readList<Godown>(STORAGE_KEY);
    const index = godowns.findIndex((gdn) => gdn.id === id);
    if (index < 0) {
      throw new Error('Godown not found');
    }
    const current = godowns[index];

    const updated = buildGodown(
      {
        ...current,
        ...payload,
        id: current.id,
        createdAt: current.createdAt,
        isActive: payload.isActive ?? current.isActive,
      },
      false
    );

    ensureUniqueGodown(godowns, updated, index);

    godowns[index] = updated;

    if (updated.isDefault) {
      ensureSingleDefault(godowns, updated.id);
    } else if (!updated.isDefault && current.isDefault) {
      // If default flag removed, other defaults must exist
      ensureDefaultExists(godowns);
    }

    await writeList(STORAGE_KEY, godowns);
    return updated;
  },

  async softDelete(id: string): Promise<void> {
    const godowns = await readList<Godown>(STORAGE_KEY);
    const index = godowns.findIndex((gdn) => gdn.id === id);
    if (index < 0) {
      throw new Error('Godown not found');
    }

    const wasDefault = godowns[index].isDefault;
    godowns[index] = { ...godowns[index], isActive: false, isDefault: false, updatedAt: nowIso() };

    if (wasDefault) {
      const replacement = godowns.find((gdn, idx) => idx !== index && gdn.isActive !== false);
      if (replacement) {
        replacement.isDefault = true;
        replacement.updatedAt = nowIso();
      } else {
        throw new Error('Cannot delete the only default godown');
      }
    }

    ensureDefaultExists(godowns);
    await writeList(STORAGE_KEY, godowns);
  },

  async restore(id: string): Promise<void> {
    const godowns = await readList<Godown>(STORAGE_KEY);
    const index = godowns.findIndex((gdn) => gdn.id === id);
    if (index < 0) {
      throw new Error('Godown not found');
    }

    godowns[index] = { ...godowns[index], isActive: true, updatedAt: nowIso() };

    if (!godowns.some((gdn) => gdn.isDefault && gdn.isActive !== false)) {
      godowns[index].isDefault = true;
    }

    await writeList(STORAGE_KEY, godowns);
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },

  async seedDefaults() {
    const godowns = await readList<Godown>(STORAGE_KEY);
    if (godowns.length > 0) return;
    const now = nowIso();
    await writeList(STORAGE_KEY, [
      {
        id: 'gdn-main',
        name: 'Main Godown',
        code: 'MAIN',
        address: null,
        isDefault: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },
};
