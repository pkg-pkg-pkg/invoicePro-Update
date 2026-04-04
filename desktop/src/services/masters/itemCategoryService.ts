import { ItemCategory } from '../../types/masters';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_item_categories';

export interface ItemCategoryFilters {
  includeInactive?: boolean;
  parentId?: string | null;
  search?: string;
}

const sortCategories = (categories: ItemCategory[]) =>
  [...categories].sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT_CATEGORIES: Omit<ItemCategory, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat-general', name: 'General', code: 'GEN', parentId: null, isActive: true },
  { id: 'cat-raw-materials', name: 'Raw Materials', code: 'RAW', parentId: null, isActive: true },
  { id: 'cat-finished-goods', name: 'Finished Goods', code: 'FIN', parentId: null, isActive: true },
];

const ensureParentValidity = (
  categoryId: string,
  parentId: string | null,
  categories: ItemCategory[]
) => {
  if (!parentId) return;

  if (categoryId && parentId === categoryId) {
    throw new Error('Category cannot be its own parent');
  }

  const parent = categories.find((cat) => cat.id === parentId);
  if (!parent) {
    throw new Error('Parent category not found');
  }
  if (parent.isActive === false) {
    throw new Error('Parent category is inactive');
  }
};

const ensureUniqueness = (
  categories: ItemCategory[],
  candidate: ItemCategory,
  skipIndex?: number
) => {
  const normalizedName = candidate.name.toLowerCase();
  const duplicateName = categories.some(
    (cat, index) => index !== skipIndex && cat.name.toLowerCase() === normalizedName
  );
  if (duplicateName) {
    throw new Error('Category name already exists');
  }

  if (candidate.code) {
    const normalizedCode = candidate.code.toLowerCase();
    const duplicateCode = categories.some(
      (cat, index) => index !== skipIndex && cat.code && cat.code.toLowerCase() === normalizedCode
    );
    if (duplicateCode) {
      throw new Error('Category code already exists');
    }
  }
};

const buildCategory = (
  payload: Partial<ItemCategory>,
  categories: ItemCategory[],
  isCreate: boolean
): ItemCategory => {
  const name = sanitizeString(payload.name ?? null);
  if (!name) {
    throw new Error('Category name is required');
  }

  if (!isCreate && !payload.id) {
    throw new Error('Category id is required');
  }

  const code = sanitizeString(payload.code ?? null);
  const parentId = sanitizeString(payload.parentId ?? null);
  const id = payload.id ?? generateId('cat');

  ensureParentValidity(id, parentId, categories);

  return {
    id,
    name,
    code,
    parentId,
    isActive: payload.isActive ?? true,
    createdAt: payload.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
};

const filterCategories = (categories: ItemCategory[], filters: ItemCategoryFilters) => {
  const searchValue = sanitizeString(filters.search ?? null)?.toLowerCase();
  return categories.filter((cat) => {
    if (!filters.includeInactive && cat.isActive === false) {
      return false;
    }
    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        if (cat.parentId !== null && cat.parentId !== undefined) return false;
      } else if (cat.parentId !== filters.parentId) {
        return false;
      }
    }
    if (searchValue) {
      const haystack = `${cat.name} ${cat.code ?? ''}`.toLowerCase();
      if (!haystack.includes(searchValue)) {
        return false;
      }
    }
    return true;
  });
};

export const itemCategoryService = {
  async list(filters: ItemCategoryFilters = {}): Promise<ItemCategory[]> {
    const categories = await readList<ItemCategory>(STORAGE_KEY);
    return sortCategories(filterCategories(categories, filters));
  },

  async getById(id: string): Promise<ItemCategory | null> {
    const categories = await readList<ItemCategory>(STORAGE_KEY);
    return categories.find((cat) => cat.id === id) ?? null;
  },

  async create(payload: Partial<ItemCategory>): Promise<ItemCategory> {
    const categories = await readList<ItemCategory>(STORAGE_KEY);
    const category = buildCategory(payload, categories, true);
    ensureUniqueness(categories, category);

    categories.push(category);
    await writeList(STORAGE_KEY, categories);
    return category;
  },

  async update(id: string, payload: Partial<ItemCategory>): Promise<ItemCategory> {
    const categories = await readList<ItemCategory>(STORAGE_KEY);
    const index = categories.findIndex((cat) => cat.id === id);
    if (index < 0) {
      throw new Error('Category not found');
    }

    const current = categories[index];
    const category = buildCategory(
      {
        ...current,
        ...payload,
        id: current.id,
        isActive: payload.isActive ?? current.isActive,
        createdAt: current.createdAt,
      },
      categories,
      false
    );

    ensureUniqueness(categories, category, index);
    categories[index] = category;
    await writeList(STORAGE_KEY, categories);
    return category;
  },

  async softDelete(id: string): Promise<void> {
    const categories = await readList<ItemCategory>(STORAGE_KEY);
    const index = categories.findIndex((cat) => cat.id === id);
    if (index < 0) {
      throw new Error('Category not found');
    }
    const hasActiveChildren = categories.some(
      (cat) => cat.parentId === id && cat.isActive !== false
    );
    if (hasActiveChildren) {
      throw new Error('Cannot delete category with active child categories');
    }

    categories[index] = { ...categories[index], isActive: false, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, categories);
  },

  async restore(id: string): Promise<void> {
    const categories = await readList<ItemCategory>(STORAGE_KEY);
    const index = categories.findIndex((cat) => cat.id === id);
    if (index < 0) {
      throw new Error('Category not found');
    }

    const parentId = categories[index].parentId ?? null;
    ensureParentValidity(categories[index].id, parentId, categories);

    categories[index] = { ...categories[index], isActive: true, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, categories);
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },

  async seedDefaults() {
    const categories = await readList<ItemCategory>(STORAGE_KEY);
    let changed = false;
    const now = nowIso();

    for (const defaultCategory of DEFAULT_CATEGORIES) {
      if (categories.some((cat) => cat.id === defaultCategory.id)) continue;
      categories.push({
        ...defaultCategory,
        createdAt: now,
        updatedAt: now,
      });
      changed = true;
    }

    if (changed) {
      await writeList(STORAGE_KEY, sortCategories(categories));
    }
  },
};
