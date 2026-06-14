export type BarcodeScanMode = 'AUTO_ADD' | 'ASK_QUANTITY';

export type BarcodeLabelSizeKey = '25x15' | '38x25' | '50x25' | 'custom';

export type BarcodeLabelFields = {
  itemName: boolean;
  barcode: boolean;
  sku: boolean;
  mrp: boolean;
  salePrice: boolean;
};

export type InventorySettings = {
  globalLowStockThreshold: number;
  lowStockNotifyDate?: string;
  barcodeScanMode: BarcodeScanMode;
  barcodeLabelSize: BarcodeLabelSizeKey;
  barcodeLabelCustomWidthMm?: number;
  barcodeLabelCustomHeightMm?: number;
  barcodeLabelFields: BarcodeLabelFields;
  /** 7-digit EAN company prefix for generated barcodes (default 8901000). */
  barcodePrefix: string;
  /** Next sequence number for generated numeric barcodes. */
  barcodeSequence: number;
};

const DEFAULT_LABEL_FIELDS: BarcodeLabelFields = {
  itemName: true,
  barcode: true,
  sku: true,
  mrp: true,
  salePrice: true,
};

const DEFAULTS: InventorySettings = {
  globalLowStockThreshold: 10,
  barcodeScanMode: 'AUTO_ADD',
  barcodeLabelSize: '38x25',
  barcodeLabelCustomWidthMm: 38,
  barcodeLabelCustomHeightMm: 25,
  barcodeLabelFields: DEFAULT_LABEL_FIELDS,
  barcodePrefix: '8901000',
  barcodeSequence: 1,
};

const SETTINGS_KEY = 'pve_inventory_settings_v1';

export function readInventorySettings(): InventorySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS, barcodeLabelFields: { ...DEFAULT_LABEL_FIELDS } };
    const parsed = JSON.parse(raw) as Partial<InventorySettings>;
    const threshold = Number(parsed.globalLowStockThreshold);
    const fields = { ...DEFAULT_LABEL_FIELDS, ...parsed.barcodeLabelFields };
    return {
      globalLowStockThreshold:
        Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULTS.globalLowStockThreshold,
      lowStockNotifyDate: parsed.lowStockNotifyDate,
      barcodeScanMode: parsed.barcodeScanMode === 'ASK_QUANTITY' ? 'ASK_QUANTITY' : 'AUTO_ADD',
      barcodeLabelSize: parsed.barcodeLabelSize ?? DEFAULTS.barcodeLabelSize,
      barcodeLabelCustomWidthMm: Number(parsed.barcodeLabelCustomWidthMm) || DEFAULTS.barcodeLabelCustomWidthMm,
      barcodeLabelCustomHeightMm: Number(parsed.barcodeLabelCustomHeightMm) || DEFAULTS.barcodeLabelCustomHeightMm,
      barcodeLabelFields: fields,
      barcodePrefix: String(parsed.barcodePrefix ?? DEFAULTS.barcodePrefix).replace(/\D/g, '').slice(0, 7) || DEFAULTS.barcodePrefix,
      barcodeSequence: Math.max(1, Number(parsed.barcodeSequence) || DEFAULTS.barcodeSequence),
    };
  } catch {
    return { ...DEFAULTS, barcodeLabelFields: { ...DEFAULT_LABEL_FIELDS } };
  }
}

export function writeInventorySettings(patch: Partial<InventorySettings>): InventorySettings {
  const next = {
    ...readInventorySettings(),
    ...patch,
    barcodeLabelFields: patch.barcodeLabelFields
      ? { ...readInventorySettings().barcodeLabelFields, ...patch.barcodeLabelFields }
      : readInventorySettings().barcodeLabelFields,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function effectiveLowStockThreshold(itemReorder?: number | null): number {
  if (itemReorder != null && itemReorder > 0) return itemReorder;
  return readInventorySettings().globalLowStockThreshold;
}

// Re-export types for backward-compatible imports
export type { BarcodeScanMode as ScanMode, BarcodeLabelSizeKey as LabelSizeKey };
