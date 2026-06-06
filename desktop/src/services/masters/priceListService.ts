import {
  InventoryItem,
  PriceList,
  PriceListEntry,
  PriceListPricingType,
  PriceListStatus,
} from '../../types/masters';
import { generateId } from '../../utils/id';
import {
  isPriceListEffective,
  resolveItemPriceFromList,
  resolvePriceListEntryRates,
  type ResolvedPriceListRates,
} from '../../utils/priceListPricing';
import { inventoryItemService } from './inventoryItemService';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_price_lists';

export const PRICE_LISTS_CHANGED_EVENT = 'pve:price-lists-changed';

export interface PriceListFilters {
  search?: string;
  status?: PriceListStatus | 'ALL';
  activeOnDate?: string;
}

export interface PriceListReportRow {
  id: string;
  name: string;
  description?: string | null;
  pricingType: PriceListPricingType;
  status: PriceListStatus;
  itemCount: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  lastUsedAt?: string | null;
}

function notifyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRICE_LISTS_CHANGED_EVENT));
  }
}

function migrateEntry(entry: Partial<PriceListEntry>): PriceListEntry {
  const itemId = sanitizeString(entry.itemId ?? null);
  if (!itemId) throw new Error('Each price list row needs an item');
  const sellingPrice = Number(entry.sellingPrice ?? entry.rate ?? 0);
  if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
    throw new Error('Selling price must be zero or positive');
  }
  const discountPercent =
    entry.discountPercent === null || entry.discountPercent === undefined
      ? null
      : Number(entry.discountPercent);
  const gstRate =
    entry.gstRate === null || entry.gstRate === undefined ? null : Number(entry.gstRate);
  const basePrice =
    entry.basePrice === null || entry.basePrice === undefined ? null : Number(entry.basePrice);
  return {
    itemId,
    sellingPrice: Number(sellingPrice.toFixed(4)),
    basePrice,
    gstRate,
    discountPercent,
  };
}

function migrateList(raw: PriceList): PriceList {
  return {
    ...raw,
    pricingType: raw.pricingType === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE',
    effectiveFrom: raw.effectiveFrom ?? null,
    effectiveTo: raw.effectiveTo ?? null,
    lastUsedAt: raw.lastUsedAt ?? null,
    entries: (raw.entries ?? []).map((e) => migrateEntry(e)),
  };
}

const DEFAULT_LIST_NAMES = ['Retail', 'Wholesale', 'Dealer', 'Contractor'] as const;

async function ensureDefaultLists(): Promise<void> {
  const rows = await readList<PriceList>(STORAGE_KEY);
  if (rows.length > 0) return;
  const now = nowIso();
  for (const name of DEFAULT_LIST_NAMES) {
    rows.push({
      id: generateId('pl'),
      name,
      description: `${name} standard rates`,
      pricingType: name === 'Retail' ? 'INCLUSIVE' : 'EXCLUSIVE',
      effectiveFrom: null,
      effectiveTo: null,
      partyIds: [],
      entries: [],
      status: 'ACTIVE',
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  await writeList(STORAGE_KEY, rows);
}

export const priceListService = {
  async list(filters: PriceListFilters = {}): Promise<PriceList[]> {
    await ensureDefaultLists();
    let rows = (await readList<PriceList>(STORAGE_KEY)).map(migrateList);
    const q = filters.search?.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => `${r.name} ${r.description ?? ''}`.toLowerCase().includes(q));
    }
    if (filters.status && filters.status !== 'ALL') {
      rows = rows.filter((r) => r.status === filters.status);
    }
    if (filters.activeOnDate) {
      const on = new Date(filters.activeOnDate);
      rows = rows.filter((r) => isPriceListEffective(r, on));
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: string): Promise<PriceList | null> {
    await ensureDefaultLists();
    const rows = await readList<PriceList>(STORAGE_KEY);
    const found = rows.find((r) => r.id === id);
    return found ? migrateList(found) : null;
  },

  async create(payload: Partial<PriceList>): Promise<PriceList> {
    const rows = await readList<PriceList>(STORAGE_KEY);
    const name = sanitizeString(payload.name ?? null);
    if (!name) throw new Error('Price list name is required');

    const entries = Array.isArray(payload.entries) ? payload.entries.map(migrateEntry) : [];
    for (const entry of entries) {
      const item = await inventoryItemService.getById(entry.itemId);
      if (!item) throw new Error('One or more items in the price list were not found');
    }

    const now = nowIso();
    const row: PriceList = migrateList({
      id: payload.id ?? generateId('pl'),
      name,
      description: sanitizeString(payload.description ?? null),
      pricingType: payload.pricingType === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE',
      effectiveFrom: payload.effectiveFrom ?? null,
      effectiveTo: payload.effectiveTo ?? null,
      partyIds: Array.isArray(payload.partyIds) ? payload.partyIds.filter(Boolean) : [],
      entries,
      status: payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      lastUsedAt: null,
      createdAt: payload.createdAt ?? now,
      updatedAt: now,
    });
    rows.push(row);
    await writeList(STORAGE_KEY, rows);
    notifyChanged();
    return row;
  },

  async update(id: string, payload: Partial<PriceList>): Promise<PriceList> {
    const rows = await readList<PriceList>(STORAGE_KEY);
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) throw new Error('Price list not found');

    const current = migrateList(rows[index]);
    const name = sanitizeString(payload.name ?? current.name) ?? current.name;
    const entries =
      payload.entries !== undefined ? payload.entries.map(migrateEntry) : current.entries;

    for (const entry of entries) {
      const item = await inventoryItemService.getById(entry.itemId);
      if (!item) throw new Error('One or more items in the price list were not found');
    }

    const updated: PriceList = migrateList({
      ...current,
      ...payload,
      id: current.id,
      name,
      description:
        payload.description !== undefined
          ? sanitizeString(payload.description ?? null)
          : current.description,
      pricingType:
        payload.pricingType === 'INCLUSIVE'
          ? 'INCLUSIVE'
          : payload.pricingType === 'EXCLUSIVE'
            ? 'EXCLUSIVE'
            : current.pricingType,
      effectiveFrom: payload.effectiveFrom !== undefined ? payload.effectiveFrom : current.effectiveFrom,
      effectiveTo: payload.effectiveTo !== undefined ? payload.effectiveTo : current.effectiveTo,
      partyIds: payload.partyIds !== undefined ? payload.partyIds : current.partyIds,
      entries,
      status: payload.status ?? current.status,
      lastUsedAt: payload.lastUsedAt !== undefined ? payload.lastUsedAt : current.lastUsedAt,
      updatedAt: nowIso(),
    });
    rows[index] = updated;
    await writeList(STORAGE_KEY, rows);
    notifyChanged();
    return updated;
  },

  async softDelete(id: string): Promise<void> {
    await this.update(id, { status: 'INACTIVE' });
  },

  async recordUsage(id: string): Promise<void> {
    if (!id) return;
    const rows = await readList<PriceList>(STORAGE_KEY);
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) return;
    rows[index] = { ...migrateList(rows[index]), lastUsedAt: nowIso(), updatedAt: nowIso() };
    await writeList(STORAGE_KEY, rows);
    notifyChanged();
  },

  resolveItemRates(list: PriceList, item: InventoryItem): ResolvedPriceListRates | null {
    return resolveItemPriceFromList(list, item);
  },

  resolveEntryRates(
    list: PriceList,
    itemId: string,
    item: InventoryItem
  ): ResolvedPriceListRates {
    const entry = list.entries.find((e) => e.itemId === itemId);
    return resolvePriceListEntryRates(list, entry, item);
  },

  async reportRows(): Promise<PriceListReportRow[]> {
    const rows = await this.list({ status: 'ALL' });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      pricingType: r.pricingType,
      status: r.status,
      itemCount: r.entries.length,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      lastUsedAt: r.lastUsedAt,
    }));
  },
};
