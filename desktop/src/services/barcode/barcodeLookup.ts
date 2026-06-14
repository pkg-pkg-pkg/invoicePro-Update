import type { InventoryItem } from '../../types/masters';
import { normalizeBarcode } from './barcodeValue';

/** All codes that should match a physical scan for this item. */
export function getItemScanCodes(item: InventoryItem): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  const add = (raw: unknown) => {
    const v = normalizeBarcode(String(raw ?? ''));
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    codes.push(v);
  };

  const barcode = normalizeBarcode(String(item.barcode ?? ''));
  const sku = normalizeBarcode(String(item.sku ?? ''));

  add(item.barcode);
  for (const alt of item.additionalBarcodes ?? []) add(alt);
  add(item.upc);
  add(item.ean);
  add(item.isbn);

  // Legacy: items saved before barcode/SKU split often have barcode === sku or empty barcode.
  if (!barcode && sku) add(sku);
  if (barcode && sku && barcode.toLowerCase() === sku.toLowerCase()) add(sku);

  return codes;
}

/** Exact scan lookup — barcode / UPC / EAN / legacy SKU-as-barcode. */
export function findItemsByBarcode(items: InventoryItem[], raw: string): InventoryItem[] {
  const code = normalizeBarcode(raw).toLowerCase();
  if (!code) return [];
  return items.filter((item) => getItemScanCodes(item).some((c) => c.toLowerCase() === code));
}

export function findUniqueItemByBarcode(items: InventoryItem[], raw: string): InventoryItem | null {
  const matches = findItemsByBarcode(items, raw);
  if (matches.length !== 1) return null;
  return matches[0];
}

/** Text search priority: exact barcode → exact SKU → name → partial. */
export function searchInventoryItems(items: InventoryItem[], query: string): InventoryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  const exactBarcode: InventoryItem[] = [];
  const exactSku: InventoryItem[] = [];
  const nameMatch: InventoryItem[] = [];
  const partial: InventoryItem[] = [];
  const seen = new Set<string>();

  const bucket = (list: InventoryItem[], item: InventoryItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    list.push(item);
  };

  for (const item of items) {
    const bc = normalizeBarcode(String(item.barcode ?? '')).toLowerCase();
    const sku = normalizeBarcode(String(item.sku ?? '')).toLowerCase();
    const name = item.name.toLowerCase();

    if (bc && bc === q) {
      bucket(exactBarcode, item);
      continue;
    }
    if (sku === q) {
      bucket(exactSku, item);
      continue;
    }
    if (name === q || name.startsWith(q)) {
      bucket(nameMatch, item);
      continue;
    }
    const haystack = `${name} ${sku} ${bc} ${item.hsnCode ?? ''} ${item.brand ?? ''}`.toLowerCase();
    if (haystack.includes(q)) bucket(partial, item);
  }

  return [...exactBarcode, ...exactSku, ...nameMatch, ...partial];
}

/** Resolve display/print code — prefer barcode, fall back to SKU for legacy rows. */
export function resolvePrintBarcode(item: Pick<InventoryItem, 'barcode' | 'sku'>): string {
  const bc = normalizeBarcode(String(item.barcode ?? ''));
  if (bc) return bc;
  return normalizeBarcode(String(item.sku ?? ''));
}
