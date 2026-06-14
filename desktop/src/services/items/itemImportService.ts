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
import { findItemByBarcode, normalizeBarcodeKey } from '../barcode/barcodeUniqueness';
import {
  formatAdditionalBarcodesForExport,
  isValidBarcodeFormat,
  isValidGstRate,
  parseAdditionalBarcodes,
  validateBarcodeList,
} from '../barcode/barcodeValidation';

/** Enterprise import / export template columns */
export const ITEM_IMPORT_HEADERS = [
  'Item Name *',
  'SKU',
  'Barcode',
  'Additional Barcodes',
  'HSN',
  'GST %',
  'Unit',
  'Purchase Price',
  'Sale Price',
  'MRP',
  'Category',
  'Brand',
  'Opening Stock',
] as const;

const TEMPLATE_EXAMPLE = [
  'PVC Wire 1.5 SQMM',
  'PVC150',
  '8901000000012',
  '8901000000099;8901000000100',
  '85444990',
  18,
  'Roll',
  850,
  1000,
  1200,
  'Wire',
  'PVE',
  50,
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

export type ItemImportResult = {
  imported: number;
  updated: number;
  failed: number;
  errors: string[];
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
  partial.name = str(o.itemname) || str(o.name);
  partial.sku = str(o.sku);
  const hsn = str(o.hsn) || str(o.hsncode);
  if (hsn) partial.hsnCode = hsn;
  const brand = str(o.brand);
  if (brand) partial.brand = brand;
  const barcode = str(o.barcode);
  if (barcode) partial.barcode = barcode;
  const additional = parseAdditionalBarcodes(
    o.additionalbarcodes ?? o.additionalbarcode ?? o.extrabarcodes ?? o.altbarcodes
  );
  if (additional.length) partial.additionalBarcodes = additional;

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

  const gr = num(o.gst) ?? num(o.gstpercent) ?? num(o.gstrate);
  if (gr !== undefined) partial.gstRate = gr;

  const pricing: NonNullable<InventoryItem['pricing']> = {};
  const pp = num(o.purchaseprice);
  const sp = num(o.saleprice) ?? num(o.sellingprice);
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

  partial.status = 'ACTIVE';
  partial.createdSource = 'IMPORT';
  return partial;
}

function isValidHsn(hsn: string | null | undefined): boolean {
  const s = String(hsn ?? '').trim();
  if (!s) return true;
  return /^\d{4,8}$/.test(s);
}

function collectRowBarcodes(partial: Partial<InventoryItem>): string[] {
  const codes: string[] = [];
  if (partial.barcode?.trim()) codes.push(partial.barcode.trim());
  for (const c of partial.additionalBarcodes ?? []) {
    if (c.trim()) codes.push(c.trim());
  }
  return codes;
}

export function validateImportRows(
  rows: Partial<InventoryItem>[],
  existingItems: InventoryItem[],
  opts: { requireHsn?: boolean } = {}
): ItemImportPreview {
  const seenSku = new Map<string, number>();
  const seenBarcode = new Map<string, number>();
  const valid: ItemImportPreviewRow[] = [];
  const invalid: ItemImportPreviewRow[] = [];

  rows.forEach((partial, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const name = String(partial.name ?? '').trim();
    const sku = String(partial.sku ?? '').trim();

    if (!name) errors.push('Item Name is required');

    if (!isValidGstRate(partial.gstRate)) {
      errors.push('Invalid GST % (use a number between 0 and 100)');
    }

    if (!partial.unitId) errors.push('Unit is missing or not recognized');

    const hsn = partial.hsnCode;
    if (opts.requireHsn && !String(hsn ?? '').trim()) {
      errors.push('HSN is missing');
    } else if (String(hsn ?? '').trim() && !isValidHsn(hsn)) {
      errors.push('Invalid HSN (use 4–8 digits)');
    }

    if (sku) {
      const skuKey = sku.toLowerCase();
      if (seenSku.has(skuKey)) errors.push(`Duplicate SKU (also on row ${seenSku.get(skuKey)})`);
      else seenSku.set(skuKey, rowNumber);
    }

    const rowCodes = collectRowBarcodes(partial);
    const listErr = validateBarcodeList(rowCodes);
    if (listErr) errors.push(listErr);

    for (const code of rowCodes) {
      if (!isValidBarcodeFormat(code)) {
        errors.push(`Invalid barcode: "${code}"`);
      }
      const barcodeKey = normalizeBarcodeKey(code);
      if (seenBarcode.has(barcodeKey)) {
        errors.push(`Duplicate Barcode (also on row ${seenBarcode.get(barcodeKey)})`);
      } else {
        seenBarcode.set(barcodeKey, rowNumber);
      }
      const matchBySku = sku ? existingItems.find((i) => i.sku.toLowerCase() === sku.toLowerCase()) : undefined;
      const owner = findItemByBarcode(existingItems, code, matchBySku?.id);
      if (owner) {
        errors.push(`Barcode already exists (Item: ${owner.name}, SKU: ${owner.sku})`);
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
    const erpRows = await parseInventoryExcelBuffer(buffer, categories, units);
    return erpRows.map((row) => {
      const merged = { ...row };
      if (!merged.createdSource) merged.createdSource = 'IMPORT';
      return merged;
    });
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
  ws.columns = ITEM_IMPORT_HEADERS.map(() => ({ width: 18 }));
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
    item.barcode ?? '',
    formatAdditionalBarcodesForExport(item.additionalBarcodes),
    item.hsnCode ?? '',
    item.gstRate ?? '',
    unitNameById.get(item.unitId) ?? item.unitId,
    item.pricing?.purchase ?? '',
    item.pricing?.sale ?? '',
    item.pricing?.mrp ?? '',
    item.categoryId ? categoryNameById.get(item.categoryId) ?? '' : '',
    item.brand ?? '',
    item.openingStock ?? '',
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
  ws.columns = ITEM_IMPORT_HEADERS.map(() => ({ width: 18 }));
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
): Promise<ItemImportResult> {
  const partials = preview.valid.map((r) => r.partial);
  const finalized = finalizeInventoryErpRows(partials, opts);
  const result = await inventoryItemService.bulkUpsert(
    finalized.map((row) => ({ ...row, createdSource: 'IMPORT' as const }))
  );
  return {
    imported: result.created,
    updated: result.updated,
    failed: preview.invalid.length + result.errors.length,
    errors: result.errors,
  };
}
