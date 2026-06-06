import { InventoryGodownStock, InventoryItem, InventoryStatus } from '../../types/masters';
import { generateId } from '../../utils/id';
import { itemCategoryService } from './itemCategoryService';
import { godownService } from './godownService';
import { assertInventoryItemCanBeDeactivated } from './masterUsageGuard';
import { unitOfMeasureService } from './unitOfMeasureService';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';
import { companyScopedKey } from '../../utils/companyStorage';

const STORAGE_KEY = companyScopedKey('pve_inventory_items');

export const INVENTORY_ITEMS_CHANGED_EVENT = 'inventoryItemsChanged';

function notifyInventoryItemsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INVENTORY_ITEMS_CHANGED_EVENT));
  }
}

export interface InventoryItemFilters {
  includeInactive?: boolean;
  categoryId?: string | null;
  unitId?: string;
  status?: InventoryStatus;
  search?: string;
}

const normalizeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return num;
};

const ensureNonNegative = (value: number, field: string) => {
  if (value < 0) {
    throw new Error(`${field} cannot be negative`);
  }
};

const validateCategory = async (categoryId: string | null) => {
  if (!categoryId) return;
  const category = await itemCategoryService.getById(categoryId);
  if (!category || category.isActive === false) {
    throw new Error('Category not found or inactive');
  }
};

const validateUnit = async (unitId: string | null, label: string) => {
  if (!unitId) {
    throw new Error(`${label} is required`);
  }
  const unit = await unitOfMeasureService.getById(unitId);
  if (!unit || unit.isActive === false) {
    throw new Error(`${label} is inactive or missing`);
  }
};

const validateGodownStocks = async (
  stocksInput: InventoryGodownStock[] | undefined,
  currentStock: number
): Promise<InventoryGodownStock[] | undefined> => {
  if (!stocksInput || stocksInput.length === 0) {
    if (currentStock !== 0) {
      throw new Error('Godown stock splits are required when current stock is non-zero');
    }
    return [];
  }

  const sanitized: InventoryGodownStock[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (const entry of stocksInput) {
    const godownId = sanitizeString(entry?.godownId ?? null);
    if (!godownId) {
      throw new Error('Godown id is required in stock splits');
    }
    if (seen.has(godownId)) {
      throw new Error('Duplicate godown detected in stock splits');
    }
    seen.add(godownId);

    const godown = await godownService.getById(godownId);
    if (!godown || godown.isActive === false) {
      throw new Error('Godown referenced in stock splits is inactive or missing');
    }

    const quantity = normalizeNumber(entry.quantity, 0);
    ensureNonNegative(quantity, 'Godown stock quantity');
    total += quantity;
    sanitized.push({ godownId, quantity });
  }

  if (Number(total.toFixed(4)) !== Number(currentStock.toFixed(4))) {
    throw new Error('Sum of godown quantities must match current stock');
  }

  return sanitized;
};

const normalizePricing = (pricing: InventoryItem['pricing']): InventoryItem['pricing'] => {
  if (!pricing) return undefined;
  const normalized: InventoryItem['pricing'] = {};
  (['purchase', 'sale', 'mrp', 'wholesale', 'distributor'] as const).forEach((key) => {
    if (pricing[key] === null || pricing[key] === undefined) return;
    const value = normalizeNumber(pricing[key], 0);
    ensureNonNegative(value, `${key} price`);
    normalized[key] = value;
  });
  return normalized;
};

const ensureUniqueFields = (
  items: InventoryItem[],
  candidate: InventoryItem,
  skipIndex?: number
) => {
  const skuDuplicate = items.some(
    (item, index) => index !== skipIndex && item.sku.toLowerCase() === candidate.sku.toLowerCase()
  );
  if (skuDuplicate) {
    throw new Error('SKU already exists');
  }

  const nameDuplicate = items.some(
    (item, index) => index !== skipIndex && item.name.toLowerCase() === candidate.name.toLowerCase()
  );
  if (nameDuplicate) {
    throw new Error('Item name already exists');
  }

  if (candidate.barcode) {
    const barcodeDuplicate = items.some(
      (item, index) => index !== skipIndex && item.barcode?.toLowerCase() === candidate.barcode!.toLowerCase()
    );
    if (barcodeDuplicate) {
      throw new Error('Barcode already exists');
    }
  }
};

const sanitizeStringArray = (items: unknown): string[] | undefined => {
  if (!Array.isArray(items)) return undefined;
  const sanitized: string[] = [];
  items.forEach((value) => {
    const sanitizedValue = sanitizeString(typeof value === 'string' ? value : null);
    if (sanitizedValue) {
      sanitized.push(sanitizedValue);
    }
  });
  return sanitized.length ? sanitized : undefined;
};

const buildInventoryItem = async (
  payload: Partial<InventoryItem>,
  existingItems: InventoryItem[],
  isCreate: boolean
): Promise<InventoryItem> => {
  const name = sanitizeString(payload.name ?? null);
  if (!name) {
    throw new Error('Item name is required');
  }

  const sku = sanitizeString(payload.sku ?? null);
  if (!sku) {
    throw new Error('SKU is required');
  }

  const brand = sanitizeString(payload.brand ?? null);
  const barcode = sanitizeString(payload.barcode ?? null);
  let categoryId = sanitizeString(payload.categoryId ?? null);
  if (!categoryId) {
    // Backward compatibility: older flows/tests created items without category.
    await itemCategoryService.seedDefaults();
    categoryId = 'cat-general';
  }
  await validateCategory(categoryId);

  const unitId = sanitizeString(payload.unitId ?? null);
  await validateUnit(unitId, 'Primary unit');

  const secondaryUnitId = sanitizeString(payload.secondaryUnitId ?? null);
  let conversionRatio: number | null = null;
  if (secondaryUnitId) {
    if (secondaryUnitId === unitId) {
      throw new Error('Secondary unit must be different from primary unit');
    }
    await validateUnit(secondaryUnitId, 'Secondary unit');
    conversionRatio = normalizeNumber(payload.conversionRatio, 0);
    if (conversionRatio <= 0) {
      throw new Error('Conversion ratio must be greater than zero when secondary unit is provided');
    }
  }

  const gstRate = normalizeNumber(payload.gstRate, 0);
  ensureNonNegative(gstRate, 'GST rate');

  const openingStock = normalizeNumber(payload.openingStock, 0);
  ensureNonNegative(openingStock, 'Opening stock');

  const openingValue = normalizeNumber(payload.openingValue, 0);
  ensureNonNegative(openingValue, 'Opening value');

  const currentStock =
    payload.currentStock !== undefined
      ? normalizeNumber(payload.currentStock, 0)
      : openingStock;
  // On create, stock must be non‑negative. On update, master form does not move stock; preserve DB value even if
  // vouchers produced temporary negative stock so users can still fix name/HSN/GST etc.
  if (isCreate) {
    ensureNonNegative(currentStock, 'Current stock');
  }

  const reorderLevel =
    payload.reorderLevel === null || payload.reorderLevel === undefined
      ? null
      : normalizeNumber(payload.reorderLevel, 0);
  if (reorderLevel !== null) {
    ensureNonNegative(reorderLevel, 'Reorder level');
  }

  let godownStocks: InventoryGodownStock[] | undefined;
  if (!isCreate && currentStock < 0) {
    // Negative on-hand stock (e.g. oversell): still allow saving master data without re-proving godown totals here.
    godownStocks = Array.isArray(payload.godownStocks) ? payload.godownStocks.map((s) => ({ ...s })) : [];
  } else {
    godownStocks = await validateGodownStocks(payload.godownStocks, currentStock);
  }
  if ((!godownStocks || godownStocks.length === 0) && Number(currentStock.toFixed(4)) === 0) {
    try {
      const activeGodowns = await godownService.list({ includeInactive: false });
      const preferred = activeGodowns.find((g) => g.isDefault) ?? activeGodowns[0];
      if (preferred) {
        godownStocks = [{ godownId: preferred.id, quantity: 0 }];
      }
    } catch {
      // If godowns cannot be read, keep empty splits as fallback.
    }
  }

  const status: InventoryStatus =
    payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const pricing = normalizePricing(payload.pricing);

  const item: InventoryItem = {
    id: payload.id ?? generateId('itm'),
    name,
    sku,
    barcode,
    brand,
    categoryId,
    unitId: unitId!,
    secondaryUnitId,
    conversionRatio,
    gstRate,
    hsnCode: sanitizeString(payload.hsnCode ?? null),
    pricing,
    trackBatch: Boolean(payload.trackBatch),
    trackSerial: Boolean(payload.trackSerial),
    trackExpiry: Boolean(payload.trackExpiry),
    openingStock,
    openingValue,
    currentStock,
    reorderLevel,
    godownStocks,
    images: sanitizeStringArray(payload.images),
    status,
    itemType: payload.itemType ?? 'BOTH',
    upc: sanitizeString(payload.upc ?? null),
    ean: sanitizeString(payload.ean ?? null),
    isbn: sanitizeString(payload.isbn ?? null),
    taxClass: payload.taxClass ?? (gstRate > 0 ? 'TAXABLE' : 'NON_TAXABLE'),
    description: sanitizeString(payload.description ?? null),
    createdSource: payload.createdSource ?? 'USER',
    createdAt: payload.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  ensureUniqueFields(existingItems, item, isCreate ? undefined : existingItems.findIndex((itm) => itm.id === item.id));
  return item;
};

const sumGodownQuantities = (stocks: InventoryGodownStock[] | undefined): number => {
  if (!stocks || stocks.length === 0) {
    return 0;
  }
  return Number(
    stocks.reduce((acc, entry) => acc + entry.quantity, 0).toFixed(4)
  );
};

const filterItems = (items: InventoryItem[], filters: InventoryItemFilters) => {
  const searchValue = sanitizeString(filters.search ?? null)?.toLowerCase();
  return items.filter((item) => {
    if (!filters.includeInactive && item.status !== 'ACTIVE') {
      return false;
    }
    if (filters.categoryId !== undefined) {
      if (filters.categoryId === null) {
        if (item.categoryId) return false;
      } else if (item.categoryId !== filters.categoryId) {
        return false;
      }
    }
    if (filters.unitId && item.unitId !== filters.unitId) {
      return false;
    }
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    if (searchValue) {
      const haystack = `${item.name} ${item.sku} ${item.barcode ?? ''}`.toLowerCase();
      if (!haystack.includes(searchValue)) {
        return false;
      }
    }
    return true;
  });
};

export const inventoryItemService = {
  async list(filters: InventoryItemFilters = {}): Promise<InventoryItem[]> {
    const items = await readList<InventoryItem>(STORAGE_KEY);
    return filterItems(items, filters).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: string): Promise<InventoryItem | null> {
    const items = await readList<InventoryItem>(STORAGE_KEY);
    return items.find((item) => item.id === id) ?? null;
  },

  async create(payload: Partial<InventoryItem>): Promise<InventoryItem> {
    const items = await readList<InventoryItem>(STORAGE_KEY);
    const item = await buildInventoryItem(payload, items, true);
    items.push(item);
    await writeList(STORAGE_KEY, items);
    notifyInventoryItemsChanged();
    return item;
  },

  async update(id: string, payload: Partial<InventoryItem>): Promise<InventoryItem> {
    const items = await readList<InventoryItem>(STORAGE_KEY);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error('Inventory item not found');
    }

    const current = items[index];
    const updated = await buildInventoryItem(
      {
        ...current,
        ...payload,
        id: current.id,
        createdAt: current.createdAt,
      },
      items,
      false
    );

    items[index] = updated;
    await writeList(STORAGE_KEY, items);
    notifyInventoryItemsChanged();
    return updated;
  },

  async softDelete(id: string): Promise<void> {
    await assertInventoryItemCanBeDeactivated(id);
    const items = await readList<InventoryItem>(STORAGE_KEY);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error('Inventory item not found');
    }
    items[index] = { ...items[index], status: 'INACTIVE', updatedAt: nowIso() };
    await writeList(STORAGE_KEY, items);
    notifyInventoryItemsChanged();
  },

  async restore(id: string): Promise<void> {
    const items = await readList<InventoryItem>(STORAGE_KEY);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error('Inventory item not found');
    }
    items[index] = { ...items[index], status: 'ACTIVE', updatedAt: nowIso() };
    await writeList(STORAGE_KEY, items);
    notifyInventoryItemsChanged();
  },

  async bulkSoftDelete(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    for (const rawId of ids) {
      await assertInventoryItemCanBeDeactivated(String(rawId));
    }
    const idSet = new Set(ids.map((id) => String(id)));
    const items = await readList<InventoryItem>(STORAGE_KEY);
    let updated = 0;
    for (let i = 0; i < items.length; i += 1) {
      if (idSet.has(items[i].id) && items[i].status !== 'INACTIVE') {
        items[i] = { ...items[i], status: 'INACTIVE', updatedAt: nowIso() };
        updated += 1;
      }
    }
    if (updated > 0) {
      await writeList(STORAGE_KEY, items);
      notifyInventoryItemsChanged();
    }
    return updated;
  },

  async bulkUpsert(rows: Partial<InventoryItem>[]) {
    const items = await readList<InventoryItem>(STORAGE_KEY);
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    const findMatchIndex = (row: Partial<InventoryItem>) => {
      if (row.id) {
        const idx = items.findIndex((item) => item.id === row.id);
        if (idx >= 0) return idx;
      }
      if (row.sku) {
        const skuKey = String(row.sku).toLowerCase();
        const idx = items.findIndex((item) => item.sku.toLowerCase() === skuKey);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || (!row.id && !row.sku)) {
        errors.push(`Row ${i + 2}: Missing id or sku`);
        continue;
      }
      try {
        const matchIndex = findMatchIndex(row);
        const base = matchIndex >= 0 ? items[matchIndex] : undefined;
        const mergedPayload: Partial<InventoryItem> = {
          ...(base ?? {}),
          ...row,
          id: base?.id ?? row.id,
        };
        const built = await buildInventoryItem(mergedPayload, items, matchIndex < 0);
        if (matchIndex >= 0) {
          items[matchIndex] = built;
          updated += 1;
        } else {
          items.push(built);
          created += 1;
        }
      } catch (err) {
        errors.push(`Row ${i + 2}: ${(err as Error).message}`);
      }
    }

    if (created || updated) {
      await writeList(STORAGE_KEY, items);
      notifyInventoryItemsChanged();
    }

    return { created, updated, errors };
  },

  async adjustStock(
    id: string,
    deltaQuantity: number,
    options: { godownId?: string | null; allowNegative?: boolean } = {}
  ): Promise<InventoryItem> {
    if (!deltaQuantity) {
      throw new Error('Stock delta must be non-zero');
    }

    const items = await readList<InventoryItem>(STORAGE_KEY);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error('Inventory item not found');
    }

    const current = items[index];
    const newStock = Number((current.currentStock + deltaQuantity).toFixed(4));
    const allowNegative = Boolean(options.allowNegative);
    if (!allowNegative && newStock < 0) {
      throw new Error('Resulting stock cannot be negative');
    }

    let updatedGodownStocks: InventoryGodownStock[] | undefined = current.godownStocks
      ? [...current.godownStocks]
      : undefined;

    const godownId = options.godownId ?? null;
    if (!updatedGodownStocks || updatedGodownStocks.length === 0) {
      if (newStock > 0) {
        if (!godownId) {
          throw new Error('Godown is required to allocate stock for this item');
        }
        updatedGodownStocks = [{ godownId, quantity: Number(deltaQuantity.toFixed(4)) }];
      } else {
        updatedGodownStocks = [];
      }
    } else {
      if (!godownId) {
        if (updatedGodownStocks.length > 1) {
          throw new Error('Godown is required to adjust stock when multiple godowns are tracked');
        }
        const singleQuantity = Number((updatedGodownStocks[0].quantity + deltaQuantity).toFixed(4));
        if (!allowNegative && singleQuantity < 0) {
          throw new Error('Resulting godown quantity cannot be negative');
        }
        updatedGodownStocks[0] = { ...updatedGodownStocks[0], quantity: singleQuantity };
      } else {
        const targetIndex = updatedGodownStocks.findIndex((entry) => entry.godownId === godownId);
        if (targetIndex >= 0) {
          const updatedQuantity = Number((updatedGodownStocks[targetIndex].quantity + deltaQuantity).toFixed(4));
          if (!allowNegative && updatedQuantity < 0) {
            throw new Error('Resulting godown quantity cannot be negative');
          }
          if (updatedQuantity === 0) {
            updatedGodownStocks.splice(targetIndex, 1);
          } else {
            updatedGodownStocks[targetIndex] = { godownId, quantity: updatedQuantity };
          }
        } else {
          if (deltaQuantity < 0 && !allowNegative) {
            throw new Error('Cannot reduce stock for a godown with no existing quantity');
          }
          updatedGodownStocks.push({ godownId, quantity: Number(deltaQuantity.toFixed(4)) });
        }
      }
    }

    if (updatedGodownStocks.length === 0 && newStock > 0) {
      throw new Error('Godown splits must be maintained for items with stock');
    }

    if (updatedGodownStocks.length > 0) {
      const total = sumGodownQuantities(updatedGodownStocks);
      if (Number(total.toFixed(4)) !== Number(newStock.toFixed(4))) {
        throw new Error('Godown stock distribution must equal current stock');
      }
    }

    items[index] = {
      ...current,
      currentStock: newStock,
      godownStocks: updatedGodownStocks.length ? updatedGodownStocks : [],
      updatedAt: nowIso(),
    };

    await writeList(STORAGE_KEY, items);
    notifyInventoryItemsChanged();
    return items[index];
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
    notifyInventoryItemsChanged();
  },

  async backfillMissingGodownSplits(itemId?: string): Promise<number> {
    const activeGodowns = (await godownService.list({ includeInactive: false })).filter((g) => g.isActive !== false);
    const preferred = activeGodowns.find((g) => g.isDefault) ?? activeGodowns[0];
    if (!preferred) return 0;

    const items = await readList<InventoryItem>(STORAGE_KEY);
    let updated = 0;
    const next = items.map((item) => {
      if (itemId && item.id !== itemId) return item;
      const hasSplits = Array.isArray(item.godownStocks) && item.godownStocks.length > 0;
      if (hasSplits) return item;
      updated += 1;
      return {
        ...item,
        godownStocks: [{ godownId: preferred.id, quantity: Number((item.currentStock || 0).toFixed(4)) }],
        updatedAt: nowIso(),
      };
    });
    if (updated > 0) {
      await writeList(STORAGE_KEY, next);
      notifyInventoryItemsChanged();
    }
    return updated;
  },
};
