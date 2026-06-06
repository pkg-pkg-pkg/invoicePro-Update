import { describe, expect, it } from 'vitest';
import {
  baseFromSelling,
  exclusiveFromInclusive,
  inclusiveFromExclusive,
  resolvePriceListEntryRates,
  sellingFromBase,
} from '../../src/utils/priceListPricing';
import type { InventoryItem, PriceList, PriceListEntry } from '../../src/types/masters';

const sampleItem: InventoryItem = {
  id: 'item-1',
  name: 'PVC Wire 1.5 sqmm',
  sku: 'PVC-15',
  unitId: 'u1',
  gstRate: 18,
  hsnCode: '8544',
  openingStock: 0,
  openingValue: 0,
  currentStock: 0,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseList = (pricingType: 'EXCLUSIVE' | 'INCLUSIVE'): PriceList => ({
  id: 'pl-1',
  name: 'Retail',
  pricingType,
  entries: [],
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('priceListPricing', () => {
  it('exclusive list keeps selling price as base', () => {
    const entry: PriceListEntry = { itemId: 'item-1', sellingPrice: 100, gstRate: 18 };
    const resolved = resolvePriceListEntryRates(baseList('EXCLUSIVE'), entry, sampleItem);
    expect(resolved.rateExclusive).toBe(100);
    expect(resolved.rateInclusive).toBe(118);
  });

  it('inclusive list treats selling price as GST inclusive', () => {
    const entry: PriceListEntry = { itemId: 'item-1', sellingPrice: 118, gstRate: 18 };
    const resolved = resolvePriceListEntryRates(baseList('INCLUSIVE'), entry, sampleItem);
    expect(resolved.rateInclusive).toBe(118);
    expect(resolved.rateExclusive).toBe(100);
  });

  it('converts base and selling for list type', () => {
    expect(sellingFromBase(100, 18, 'EXCLUSIVE')).toBe(100);
    expect(sellingFromBase(100, 18, 'INCLUSIVE')).toBe(118);
    expect(baseFromSelling(118, 18, 'INCLUSIVE')).toBe(100);
    expect(inclusiveFromExclusive(100, 18)).toBe(118);
    expect(exclusiveFromInclusive(118, 18)).toBe(100);
  });
});
