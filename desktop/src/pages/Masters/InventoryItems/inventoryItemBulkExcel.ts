import ExcelJS from 'exceljs';
import type { InventoryItem, ItemCategory, UnitOfMeasure } from '../../../types/masters';

export const INVENTORY_BULK_SHEET = 'Inventory Items';

/** Column headers — first row of exported file (also accepted on import, case/spacing insensitive). */
export const INVENTORY_EXCEL_HEADERS = [
  'id',
  'name',
  'sku',
  'barcode',
  'brand',
  'categoryId',
  'category',
  'unitId',
  'unit',
  'secondaryUnit',
  'conversionRatio',
  'gstRate',
  'hsnCode',
  'openingStock',
  'openingValue',
  'currentStock',
  'reorderLevel',
  'status',
  'purchasePrice',
  'salePrice',
  'mrp',
  'wholesale',
  'distributor',
  'trackBatch',
  'trackSerial',
  'trackExpiry',
  'godownStocksJson',
] as const;

function normHeader(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\s+/g, '');
}

/** Non-empty string from row object using first matching key (Tally / Busy / Marg style headers). */
function firstCellStr(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function firstCellNum(o: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    const n = Number(String(v).replace(/,/g, ''));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function hasMeaningfulCell(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return !Number.isNaN(v);
  return String(v).trim() !== '';
}

/**
 * Map common ERP export column names onto keys expected by {@link buildPartialFromRow}.
 * Safe to call on every row; only fills targets when they are empty.
 */
export function applyInventoryErpAliases(o: Record<string, unknown>): void {
  const setStr = (target: string, sources: string[]) => {
    if (hasMeaningfulCell(o[target])) return;
    const s = firstCellStr(o, sources);
    if (s) o[target] = s;
  };
  const setNum = (target: string, sources: string[]) => {
    if (hasMeaningfulCell(o[target])) return;
    const n = firstCellNum(o, sources);
    if (n !== undefined) o[target] = n;
  };

  setStr('name', [
    'name',
    'stockitemname',
    'itemname',
    'productname',
    'description',
    'particulars',
    'stockitem',
    'item',
  ]);
  setStr('sku', ['sku', 'itemcode', 'stockitemcode', 'productcode', 'code', 'skucode', 'alias']);
  setStr('barcode', ['barcode', 'barcodenumber', 'ean']);
  setStr('brand', ['brand', 'manufacturer', 'make']);
  setStr('category', ['category', 'stockgroup', 'group', 'itemcategory', 'productcategory']);
  setStr('categoryid', ['categoryid']);
  setStr('unit', ['unit', 'uom', 'baseunit', 'unitofmeasurement', 'stockuom', 'unitname']);
  setStr('unitid', ['unitid']);
  setStr('secondaryunit', ['secondaryunit', 'altunit', 'alternateunit']);
  setStr('hsncode', ['hsncode', 'hsn', 'hsnsac', 'hsn/sac']);

  setNum('gstrate', ['gstrate', 'gst', 'gst%', 'gstpercent', 'taxrate', 'rateofgst']);
  setNum('openingstock', ['openingstock', 'openingqty', 'openingbalance', 'opqty', 'opening']);
  setNum('openingvalue', ['openingvalue', 'openingstockvalue', 'openingratevalue']);
  setNum('currentstock', [
    'currentstock',
    'closingstock',
    'stockonhand',
    'stockinhand',
    'availableqty',
    'balanceqty',
    'qty',
    'quantity',
  ]);
  setNum('reorderlevel', ['reorderlevel', 'reorder', 'minlevel', 'minimumlevel', 'minstock']);

  setNum('purchaseprice', ['purchaseprice', 'purchaserate', 'prate', 'costprice', 'buyingprice']);
  setNum('saleprice', ['saleprice', 'salerate', 'sellingprice', 'salesrate', 'selling']);
  setNum('mrp', ['mrp', 'mrpprice', 'listprice']);
  setNum('wholesale', ['wholesale', 'wsp', 'wholesalerate']);
  setNum('distributor', ['distributor', 'dprate', 'distributorprice']);
}

/**
 * After parsing from ERP Excel: ensure SKU, primary unit, and godown split when stock is non-zero.
 */
export function finalizeInventoryErpRows(
  rows: Partial<InventoryItem>[],
  opts: { defaultUnitId: string; defaultGodownId: string | null }
): Partial<InventoryItem>[] {
  return rows.map((row, index) => {
    const next = { ...row };
    const name = String(next.name ?? '').trim();
    if (!next.sku || !String(next.sku).trim()) {
      const slug = name
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24)
        .toUpperCase();
      next.sku = `${slug || 'ITEM'}-${String(index + 1).padStart(4, '0')}`;
    }
    if (!next.unitId) {
      next.unitId = opts.defaultUnitId;
    }
    const opening = Number(next.openingStock ?? 0);
    const effectiveCurrent =
      next.currentStock !== undefined ? Number(next.currentStock) : opening;
    if (effectiveCurrent > 0 && opts.defaultGodownId && (!next.godownStocks || next.godownStocks.length === 0)) {
      next.godownStocks = [{ godownId: opts.defaultGodownId, quantity: Number(effectiveCurrent.toFixed(4)) }];
    }
    return next;
  });
}

function boolToCell(v: boolean | undefined): string {
  return v ? 'Y' : 'N';
}

function parseBool(v: unknown): boolean | undefined {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!s) return undefined;
  if (['y', 'yes', 'true', '1'].includes(s)) return true;
  if (['n', 'no', 'false', '0'].includes(s)) return false;
  return undefined;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? undefined : n;
}

function findCategoryId(categories: ItemCategory[], label: string): string | undefined {
  const q = label.trim().toLowerCase();
  if (!q) return undefined;
  const c = categories.find(
    (x) => x.name.toLowerCase() === q || (x.code && x.code.toLowerCase() === q)
  );
  return c?.id;
}

function findUnitId(units: UnitOfMeasure[], label: string): string | undefined {
  const q = label.trim().toLowerCase();
  if (!q) return undefined;
  const u = units.find(
    (x) =>
      x.name.toLowerCase() === q ||
      x.symbol.toLowerCase() === q ||
      (x.uqc && x.uqc.toLowerCase() === q) ||
      x.id.toLowerCase() === q
  );
  return u?.id;
}

function rowObjectFromWorksheet(
  ws: ExcelJS.Worksheet,
  colMap: Map<number, string>,
  rowIndex: number
): Record<string, unknown> | null {
  const row = ws.getRow(rowIndex);
  const o: Record<string, unknown> = {};
  let any = false;
  colMap.forEach((headerKey, colNumber) => {
    const cell = row.getCell(colNumber);
    const raw = cell.value;
    let val: unknown;
    if (raw === null || raw === undefined) {
      val = '';
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      val = raw;
    } else if (typeof raw === 'object' && raw !== null && 'result' in raw) {
      val = (raw as { result?: unknown }).result ?? '';
    } else {
      val = cell.text?.trim() ?? str(raw);
    }
    if (val !== '' && val !== null && val !== undefined) {
      any = true;
    }
    o[headerKey] = val;
  });
  return any ? o : null;
}

function buildPartialFromRow(
  o: Record<string, unknown>,
  categories: ItemCategory[],
  units: UnitOfMeasure[]
): Partial<InventoryItem> {
  const out: Partial<InventoryItem> = {};
  const g = (k: string) => o[k];

  const id = str(g('id'));
  if (id) out.id = id;

  out.name = str(g('name'));
  out.sku = str(g('sku'));

  const barcode = str(g('barcode'));
  if (barcode) out.barcode = barcode;

  const brand = str(g('brand'));
  if (brand) out.brand = brand;

  const categoryIdDirect = str(g('categoryid'));
  const categoryLabel = str(g('category'));
  if (categoryIdDirect) {
    out.categoryId = categoryIdDirect;
  } else if (categoryLabel) {
    const cid = findCategoryId(categories, categoryLabel);
    if (cid) out.categoryId = cid;
  }

  const unitIdDirect = str(g('unitid'));
  const unitLabel = str(g('unit'));
  if (unitIdDirect) {
    out.unitId = unitIdDirect;
  } else if (unitLabel) {
    const uid = findUnitId(units, unitLabel);
    if (uid) out.unitId = uid;
  }

  const secDirect = str(g('secondaryunitid'));
  const secLabel = str(g('secondaryunit'));
  if (secDirect) {
    out.secondaryUnitId = secDirect;
  } else if (secLabel) {
    const sid = findUnitId(units, secLabel);
    if (sid) out.secondaryUnitId = sid;
  }

  const cr = num(g('conversionratio'));
  if (cr !== undefined) out.conversionRatio = cr;

  const gr = num(g('gstrate'));
  if (gr !== undefined) out.gstRate = gr;

  const hsn = str(g('hsncode'));
  if (hsn) out.hsnCode = hsn;

  const os = num(g('openingstock'));
  if (os !== undefined) out.openingStock = os;

  const ov = num(g('openingvalue'));
  if (ov !== undefined) out.openingValue = ov;

  const cs = num(g('currentstock'));
  if (cs !== undefined) out.currentStock = cs;

  const rl = num(g('reorderlevel'));
  if (rl !== undefined) out.reorderLevel = rl;

  const st = str(g('status')).toUpperCase();
  if (st === 'ACTIVE' || st === 'INACTIVE') out.status = st;

  const pricing: NonNullable<InventoryItem['pricing']> = {};
  const p = num(g('purchaseprice'));
  const s = num(g('saleprice'));
  const m = num(g('mrp'));
  const w = num(g('wholesale'));
  const d = num(g('distributor'));
  if (p !== undefined) pricing.purchase = p;
  if (s !== undefined) pricing.sale = s;
  if (m !== undefined) pricing.mrp = m;
  if (w !== undefined) pricing.wholesale = w;
  if (d !== undefined) pricing.distributor = d;
  if (Object.keys(pricing).length) out.pricing = pricing;

  const tb = parseBool(g('trackbatch'));
  const ts = parseBool(g('trackserial'));
  const te = parseBool(g('trackexpiry'));
  if (tb !== undefined) out.trackBatch = tb;
  if (ts !== undefined) out.trackSerial = ts;
  if (te !== undefined) out.trackExpiry = te;

  const gj = str(g('godownstocksjson'));
  if (gj) {
    try {
      const parsed = JSON.parse(gj) as unknown;
      if (Array.isArray(parsed)) {
        out.godownStocks = parsed as InventoryItem['godownStocks'];
      }
    } catch {
      throw new Error('Invalid godownStocksJson — must be valid JSON array');
    }
  }

  return out;
}

export async function exportInventoryItemsExcel(
  items: InventoryItem[],
  categoryNameById: Map<string, string>,
  unitNameById: Map<string, string>
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(INVENTORY_BULK_SHEET);
  ws.addRow([...INVENTORY_EXCEL_HEADERS]);

  const appendItem = (item: InventoryItem) => {
    ws.addRow([
      item.id,
      item.name,
      item.sku,
      item.barcode ?? '',
      item.brand ?? '',
      item.categoryId ?? '',
      item.categoryId ? categoryNameById.get(item.categoryId) ?? item.categoryId : '',
      item.unitId ?? '',
      unitNameById.get(item.unitId) ?? item.unitId,
      item.secondaryUnitId ? unitNameById.get(item.secondaryUnitId) ?? item.secondaryUnitId : '',
      item.conversionRatio ?? '',
      item.gstRate,
      item.hsnCode ?? '',
      item.openingStock,
      item.openingValue,
      item.currentStock,
      item.reorderLevel ?? '',
      item.status,
      item.pricing?.purchase ?? '',
      item.pricing?.sale ?? '',
      item.pricing?.mrp ?? '',
      item.pricing?.wholesale ?? '',
      item.pricing?.distributor ?? '',
      boolToCell(item.trackBatch),
      boolToCell(item.trackSerial),
      boolToCell(item.trackExpiry),
      item.godownStocks?.length ? JSON.stringify(item.godownStocks) : '',
    ]);
  };

  if (items.length) {
    items.forEach(appendItem);
  } else {
    ws.addRow([
      '',
      'Sample Item Name',
      'SKU-001',
      '',
      '',
      '',
      'General',
      '',
      'Pieces',
      '',
      '',
      18,
      '',
      0,
      0,
      0,
      '',
      'ACTIVE',
      '',
      '',
      '',
      '',
      '',
      'N',
      'N',
      'N',
      '',
    ]);
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function parseInventoryExcelBuffer(
  buffer: ArrayBuffer,
  categories: ItemCategory[],
  units: UnitOfMeasure[]
): Promise<Partial<InventoryItem>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error('Excel file has no worksheets');
  }

  const headerRow = ws.getRow(1);
  const colMap = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const key = normHeader(cell.text ?? String(cell.value ?? ''));
    if (key) colMap.set(colNumber, key);
  });

  if (colMap.size === 0) {
    throw new Error('Excel file has no header row');
  }

  const out: Partial<InventoryItem>[] = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const o = rowObjectFromWorksheet(ws, colMap, r);
    if (!o) continue;
    applyInventoryErpAliases(o);
    out.push(buildPartialFromRow(o, categories, units));
  }

  if (!out.length) {
    throw new Error('No data rows found in Excel file');
  }

  return out;
}
