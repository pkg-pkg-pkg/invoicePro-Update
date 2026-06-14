import type { InventoryItem } from '../../types/masters';
import { normalizeBarcode } from './barcodeValue';
import { inventoryItemService } from '../masters/inventoryItemService';

export class BarcodeDuplicateError extends Error {
  readonly code = 'BARCODE_DUPLICATE' as const;
  readonly barcode: string;
  readonly existingItem: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'barcode'>;

  constructor(barcode: string, existingItem: InventoryItem) {
    super('Barcode already exists');
    this.name = 'BarcodeDuplicateError';
    this.barcode = barcode;
    this.existingItem = {
      id: existingItem.id,
      name: existingItem.name,
      sku: existingItem.sku,
      barcode: existingItem.barcode,
    };
  }
}

export function isBarcodeDuplicateError(err: unknown): err is BarcodeDuplicateError {
  return err instanceof BarcodeDuplicateError;
}

/** Case-insensitive trimmed barcode key for uniqueness maps. */
export function normalizeBarcodeKey(raw: string): string {
  return normalizeBarcode(raw).toLowerCase();
}

/** Primary + additional barcodes assigned to one item. */
export function getAllBarcodesForItem(item: Pick<InventoryItem, 'barcode' | 'additionalBarcodes'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: unknown) => {
    const v = normalizeBarcode(String(raw ?? ''));
    if (!v) return;
    const key = normalizeBarcodeKey(v);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  add(item.barcode);
  for (const code of item.additionalBarcodes ?? []) add(code);
  return out;
}

export function findItemByBarcode(
  items: InventoryItem[],
  barcode: string,
  excludeItemId?: string | null
): InventoryItem | null {
  const key = normalizeBarcodeKey(barcode);
  if (!key) return null;
  for (const item of items) {
    if (excludeItemId && item.id === excludeItemId) continue;
    for (const code of getAllBarcodesForItem(item)) {
      if (normalizeBarcodeKey(code) === key) return item;
    }
  }
  return null;
}

/** @alias findItemByBarcode — any assigned code resolves to the item. */
export const findItemByAnyBarcode = findItemByBarcode;

export function assertBarcodeUnique(
  items: InventoryItem[],
  barcode: string | null | undefined,
  excludeItemId?: string | null
): void {
  const trimmed = normalizeBarcode(String(barcode ?? ''));
  if (!trimmed) return;
  const existing = findItemByBarcode(items, trimmed, excludeItemId);
  if (existing) throw new BarcodeDuplicateError(trimmed, existing);
}

export function assertItemBarcodesUnique(
  items: InventoryItem[],
  candidate: InventoryItem,
  excludeItemId?: string | null
): void {
  const codes = getAllBarcodesForItem(candidate);
  const keys = codes.map(normalizeBarcodeKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Duplicate barcodes on the same item');
  }
  for (const code of codes) {
    assertBarcodeUnique(items, code, excludeItemId ?? candidate.id);
  }
}

/** Full-list guard before persisting inventory (database-level protection). */
export function assertInventoryBarcodeIndex(items: InventoryItem[]): void {
  const ownerByKey = new Map<string, string>();
  for (const item of items) {
    for (const code of getAllBarcodesForItem(item)) {
      const key = normalizeBarcodeKey(code);
      const ownerId = ownerByKey.get(key);
      if (ownerId && ownerId !== item.id) {
        const conflict = items.find((i) => i.id === ownerId);
        if (conflict) throw new BarcodeDuplicateError(code, conflict);
        throw new BarcodeDuplicateError(code, item);
      }
      ownerByKey.set(key, item.id);
    }
  }
}

export function buildBarcodeIndex(items: InventoryItem[]): Record<string, string> {
  const index: Record<string, string> = {};
  for (const item of items) {
    for (const code of getAllBarcodesForItem(item)) {
      index[normalizeBarcodeKey(code)] = item.id;
    }
  }
  return index;
}

export async function lookupBarcodeDuplicate(
  barcode: string,
  excludeItemId?: string | null
): Promise<InventoryItem | null> {
  const trimmed = normalizeBarcode(barcode);
  if (!trimmed) return null;
  const items = await inventoryItemService.list({ includeInactive: true });
  return findItemByBarcode(items, trimmed, excludeItemId);
}
