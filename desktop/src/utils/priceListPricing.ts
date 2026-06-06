import type { InventoryItem, PriceList, PriceListEntry, PriceListPricingType } from '../types/masters';

export type ResolvedPriceListRates = {
  gstRate: number;
  basePrice: number;
  sellingPrice: number;
  discountPercent: number;
  rateExclusive: number;
  rateInclusive: number;
  pricingType: PriceListPricingType;
};

const round2 = (n: number) => Number(n.toFixed(2));

export function exclusiveFromInclusive(inclusive: number, gstRate: number): number {
  if (gstRate <= 0) return round2(inclusive);
  return round2(inclusive / (1 + gstRate / 100));
}

export function inclusiveFromExclusive(exclusive: number, gstRate: number): number {
  if (gstRate <= 0) return round2(exclusive);
  return round2(exclusive * (1 + gstRate / 100));
}

export function applyDiscount(amount: number, discountPercent: number): number {
  const d = Number(discountPercent ?? 0);
  if (!Number.isFinite(d) || d <= 0) return round2(amount);
  return round2(amount * (1 - d / 100));
}

/** Compute selling price from base price and list pricing type. */
export function sellingFromBase(basePrice: number, gstRate: number, pricingType: PriceListPricingType): number {
  const base = round2(basePrice);
  return pricingType === 'INCLUSIVE' ? inclusiveFromExclusive(base, gstRate) : base;
}

/** Compute base price from entered selling price. */
export function baseFromSelling(sellingPrice: number, gstRate: number, pricingType: PriceListPricingType): number {
  const selling = round2(sellingPrice);
  return pricingType === 'INCLUSIVE' ? exclusiveFromInclusive(selling, gstRate) : selling;
}

export function findPriceListEntry(list: PriceList, itemId: string): PriceListEntry | undefined {
  return list.entries.find((e) => e.itemId === itemId);
}

export function resolvePriceListEntryRates(
  list: PriceList,
  entry: PriceListEntry | undefined,
  item: InventoryItem
): ResolvedPriceListRates {
  const pricingType = list.pricingType ?? 'EXCLUSIVE';
  const gstRate = Number(entry?.gstRate ?? item.gstRate ?? 0);
  const discountPercent = Number(entry?.discountPercent ?? 0);

  const rawSelling = Number(
    entry?.sellingPrice ?? entry?.rate ?? entry?.basePrice ?? item.pricing?.sale ?? 0
  );
  const sellingPrice = applyDiscount(rawSelling, discountPercent);

  let rateExclusive: number;
  let rateInclusive: number;
  let basePrice: number;

  if (pricingType === 'INCLUSIVE') {
    rateInclusive = sellingPrice;
    rateExclusive = exclusiveFromInclusive(sellingPrice, gstRate);
    basePrice = entry?.basePrice != null ? Number(entry.basePrice) : rateExclusive;
  } else {
    rateExclusive = sellingPrice;
    rateInclusive = inclusiveFromExclusive(sellingPrice, gstRate);
    basePrice = entry?.basePrice != null ? Number(entry.basePrice) : rateExclusive;
  }

  return {
    gstRate,
    basePrice: round2(basePrice),
    sellingPrice: round2(sellingPrice),
    discountPercent,
    rateExclusive,
    rateInclusive,
    pricingType,
  };
}

export function resolveItemPriceFromList(
  list: PriceList | null | undefined,
  item: InventoryItem
): ResolvedPriceListRates | null {
  if (!list || list.status !== 'ACTIVE') return null;
  const entry = findPriceListEntry(list, item.id);
  if (!entry && !item.pricing?.sale) return null;
  return resolvePriceListEntryRates(list, entry, item);
}

export function isPriceListEffective(list: PriceList, onDate = new Date()): boolean {
  if (list.status !== 'ACTIVE') return false;
  const ts = onDate.getTime();
  if (list.effectiveFrom) {
    const from = Date.parse(list.effectiveFrom);
    if (!Number.isNaN(from) && ts < from) return false;
  }
  if (list.effectiveTo) {
    const to = Date.parse(list.effectiveTo);
    if (!Number.isNaN(to) && ts > to) return false;
  }
  return true;
}
