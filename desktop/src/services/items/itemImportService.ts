import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import JSZip from 'jszip';
import type { InventoryItem, ItemCategory, UnitOfMeasure } from '../../types/masters';
import {
  applyInventoryErpAliases,
  finalizeInventoryErpRows,
  parseInventoryExcelBuffer,
} from '../../pages/Masters/InventoryItems/inventoryItemBulkExcel';
import { inventoryItemService } from '../masters/inventoryItemService';

/** User-facing import / export template columns */
export const ITEM_IMPORT_HEADERS = [
  'Item Name *',
  'SKU',
  'HSN Code',
  'Category',
  'Brand',
  'Unit',
  'GST %',
  'Purchase Price',
  'Selling Price',
  'MRP',
  'Opening Stock',
  'Min Stock',
  'Barcode',
] as const;

const TEMPLATE_EXAMPLE = [
  'PVC Wire 1.5 SQMM',
  'PVC150',
  '85444990',
  'Wire',
  'Vinay Electricals',
  'Roll',
  18,
  850,
  1000,
  1200,
  50,
  10,
  '123456789',
];

export type ItemImportPreviewRow = {
  rowNumber: number;
  partial: Partial<InventoryItem>;
  errors: string[];
};

export type ItemImportPreview = {
  valid: ItemImportPreviewRow[];
  invalid: ItemImportPreviewRow[];
  total: number;
};

function normHeader(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\s+/g, '');
}

function rowObjectToPartial(
  raw: Record<string, unknown>,
  categories: ItemCategory[],
  units: UnitOfMeasure[]
): Partial<InventoryItem> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    o[normHeader(k)] = v;
  }
  applyInventoryErpAliases(o);

  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  const num = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isNaN(n) ? undefined : n;
  };

  const findCategoryId = (label: string) => {
    const q = label.trim().toLowerCase();
    if (!q) return undefined;
    return categories.find((x) => x.name.toLowerCase() === q || x.code?.toLowerCase() === q)?.id;
  };

  const findUnitId = (label: string) => {
    const q = label.trim().toLowerCase();
    if (!q) return undefined;
    return units.find(
      (x) =>
        x.name.toLowerCase() === q ||
        x.symbol.toLowerCase() === q ||
        x.uqc?.toLowerCase() === q ||
        x.id.toLowerCase() === q
    )?.id;
  };

  const partial: Partial<InventoryItem> = {};
  partial.name = str(o.name);
  partial.sku = str(o.sku);
  const hsn = str(o.hsncode);
  if (hsn) partial.hsnCode = hsn;
  const brand = str(o.brand);
  if (brand) partial.brand = brand;
  const barcode = str(o.barcode);
  if (barcode) partial.barcode = barcode;

  const categoryLabel = str(o.category);
  if (categoryLabel) {
    const cid = findCategoryId(categoryLabel);
    if (cid) partial.categoryId = cid;
  }

  const unitLabel = str(o.unit);
  if (unitLabel) {
    const uid = findUnitId(unitLabel);
    if (uid) partial.unitId = uid;
  } else if (str(o.unitid)) {
    partial.unitId = str(o.unitid);
  }

  const gr = num(o.gstrate);
  if (gr !== undefined) partial.gstRate = gr;

  const pricing: NonNullable<InventoryItem['pricing']> = {};
  const pp = num(o.purchaseprice);
  const sp = num(o.saleprice);
  const mrp = num(o.mrp);
  if (pp !== undefined) pricing.purchase = pp;
  if (sp !== undefined) pricing.sale = sp;
  if (mrp !== undefined) pricing.mrp = mrp;
  if (Object.keys(pricing).length) partial.pricing = pricing;

  const os = num(o.openingstock);
  if (os !== undefined) {
    partial.openingStock = os;
    partial.currentStock = os;
  }
  const rl = num(o.reorderlevel);
  if (rl !== undefined) partial.reorderLevel = rl;

  partial.status = 'ACTIVE';
  return partial;
}

function isValidHsn(hsn: string | null | undefined): boolean {
  const s = String(hsn ?? '').trim();
  if (!s) return false;
  return /^\d{4,8}$/.test(s);
}

export function validateImportRows(
  rows: Partial<InventoryItem>[],
  existingItems: InventoryItem[],
  opts: { requireHsn?: boolean } = {}
): ItemImportPreview {
  const seenSku = new Map<string, number>();
  const seenName = new Map<string, number>();
  const existingSku = new Set(existingItems.map((i) => i.sku.toLowerCase()));
  const existingName = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));

  const valid: ItemImportPreviewRow[] = [];
  const invalid: ItemImportPreviewRow[] = [];

  rows.forEach((partial, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const name = String(partial.name ?? '').trim();
    const sku = String(partial.sku ?? '').trim();

    if (!name) errors.push('Item Name is required');

    if (partial.gstRate === undefined || partial.gstRate === null || Number.isNaN(Number(partial.gstRate))) {
      errors.push('GST % is missing');
    }

    if (!partial.unitId) errors.push('Unit is missing or not recognized');

    const hsn = partial.hsnCode;
    if (opts.requireHsn && !String(hsn ?? '').trim()) {
      errors.push('HSN Code is missing');
    } else if (String(hsn ?? '').trim() && !isValidHsn(hsn)) {
      errors.push('Invalid HSN Code (use 4–8 digits)');
    }

    if (sku) {
      const skuKey = sku.toLowerCase();
      if (seenSku.has(skuKey)) errors.push(`Duplicate SKU (also on row ${seenSku.get(skuKey)})`);
      else seenSku.set(skuKey, rowNumber);
    }

    if (name) {
      const nameKey = name.toLowerCase();
      if (seenName.has(nameKey)) errors.push(`Duplicate Item Name (also on row ${seenName.get(nameKey)})`);
      else seenName.set(nameKey, rowNumber);
      if (sku && !existingSku.has(sku.toLowerCase()) && existingName.has(nameKey)) {
        errors.push('Duplicate Item Name (already in inventory)');
      }
    }

    const entry: ItemImportPreviewRow = { rowNumber, partial, errors };
    if (errors.length) invalid.push(entry);
    else valid.push(entry);
  });

  return { valid, invalid, total: rows.length };
}

function parseCsvObjects(text: string): Record<string, unknown>[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? 'Invalid CSV file');
  }
  return parsed.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== '')
  );
}

export async function parseItemImportFile(
  file: File,
  categories: ItemCategory[],
  units: UnitOfMeasure[]
): Promise<Partial<InventoryItem>[]> {
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith('.csv')) {
    const text = await file.text();
    const objects = parseCsvObjects(text);
    if (!objects.length) throw new Error('CSV file has no data rows');
    return objects.map((o) => rowObjectToPartial(o, categories, units));
  }
  if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseInventoryExcelBuffer(buffer, categories, units);
  }
  throw new Error('Unsupported file type. Use .xlsx or .csv');
}

export async function buildImportPreview(
  file: File,
  categories: ItemCategory[],
  units: UnitOfMeasure[]
): Promise<ItemImportPreview> {
  const rows = await parseItemImportFile(file, categories, units);
  const existing = await inventoryItemService.list({ includeInactive: true });
  return validateImportRows(rows, existing);
}

export async function downloadItemImportTemplate(format: 'xlsx' | 'csv'): Promise<void> {
  if (format === 'csv') {
    const csv = Papa.unparse({
      fields: [...ITEM_IMPORT_HEADERS],
      data: [TEMPLATE_EXAMPLE],
    });
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'item-import-template.csv');
    return;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Item Import');
  ws.addRow([...ITEM_IMPORT_HEADERS]);
  ws.addRow(TEMPLATE_EXAMPLE);
  ws.getRow(1).font = { bold: true };
  ws.columns = ITEM_IMPORT_HEADERS.map(() => ({ width: 16 }));
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'item-import-template.xlsx'
  );
}

function itemRowsForExport(
  items: InventoryItem[],
  categoryNameById: Map<string, string>,
  unitNameById: Map<string, string>
): (string | number)[][] {
  return items.map((item) => [
    item.name,
    item.sku,
    item.hsnCode ?? '',
    item.categoryId ? categoryNameById.get(item.categoryId) ?? '' : '',
    item.brand ?? '',
    unitNameById.get(item.unitId) ?? item.unitId,
    item.gstRate ?? '',
    item.pricing?.purchase ?? '',
    item.pricing?.sale ?? '',
    item.pricing?.mrp ?? '',
    item.openingStock ?? '',
    item.reorderLevel ?? '',
    item.barcode ?? '',
  ]);
}

export async function exportItemsCsv(
  items: InventoryItem[],
  categoryNameById: Map<string, string>,
  unitNameById: Map<string, string>
): Promise<void> {
  const data = itemRowsForExport(items, categoryNameById, unitNameById);
  const csv = Papa.unparse({ fields: [...ITEM_IMPORT_HEADERS], data });
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `items-export-${today()}.csv`);
}

export async function exportItemsExcel(
  items: InventoryItem[],
  categoryNameById: Map<string, string>,
  unitNameById: Map<string, string>
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Items');
  ws.addRow([...ITEM_IMPORT_HEADERS]);
  for (const row of itemRowsForExport(items, categoryNameById, unitNameById)) {
    ws.addRow(row);
  }
  ws.getRow(1).font = { bold: true };
  ws.columns = ITEM_IMPORT_HEADERS.map(() => ({ width: 16 }));
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `items-export-${today()}.xlsx`
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/** Match SKU.jpg / SKU.png inside ZIP and attach as item.images[0] */
export async function attachImagesFromZip(zipFile: File): Promise<{ matched: number; skipped: number }> {
  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const items = await inventoryItemService.list({ includeInactive: true });
  const bySku = new Map(items.map((i) => [i.sku.toLowerCase(), i]));
  let matched = 0;
  let skipped = 0;

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  for (const [path, file] of entries) {
    const base = path.split('/').pop() ?? path;
    const m = base.match(/^(.+)\.(jpe?g|png|webp)$/i);
    if (!m) {
      skipped += 1;
      continue;
    }
    const skuKey = m[1].trim().toLowerCase();
    const item = bySku.get(skuKey);
    if (!item) {
      skipped += 1;
      continue;
    }
    const blob = await file.async('blob');
    const dataUrl = await readFileAsDataUrl(blob);
    await inventoryItemService.update(item.id, { images: [dataUrl] });
    matched += 1;
  }

  return { matched, skipped };
}

export async function importValidRows(
  preview: ItemImportPreview,
  opts: {
    defaultUnitId: string;
    defaultGodownId: string | null;
  }
): Promise<{ created: number; updated: number; errors: string[] }> {
  const partials = preview.valid.map((r) => r.partial);
  const finalized = finalizeInventoryErpRows(partials, opts);
  return inventoryItemService.bulkUpsert(finalized);
}
