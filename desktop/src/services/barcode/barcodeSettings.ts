import {
  readInventorySettings,
  type BarcodeLabelFields,
  type BarcodeLabelSizeKey,
  type BarcodeScanMode,
} from '../inventory/lowStockSettings';

export type ResolvedLabelDimensions = {
  widthMm: number;
  heightMm: number;
  label: string;
};

const LABEL_PRESETS: Record<Exclude<BarcodeLabelSizeKey, 'custom'>, ResolvedLabelDimensions> = {
  '25x15': { widthMm: 25, heightMm: 15, label: '25×15 mm' },
  '38x25': { widthMm: 38, heightMm: 25, label: '38×25 mm' },
  '50x25': { widthMm: 50, heightMm: 25, label: '50×25 mm' },
};

export function readBarcodeScanMode(): BarcodeScanMode {
  return readInventorySettings().barcodeScanMode ?? 'AUTO_ADD';
}

export function resolveLabelDimensions(sizeKey?: BarcodeLabelSizeKey): ResolvedLabelDimensions {
  const settings = readInventorySettings();
  const key = sizeKey ?? settings.barcodeLabelSize ?? '38x25';
  if (key === 'custom') {
    return {
      widthMm: settings.barcodeLabelCustomWidthMm ?? 38,
      heightMm: settings.barcodeLabelCustomHeightMm ?? 25,
      label: `Custom (${settings.barcodeLabelCustomWidthMm ?? 38}×${settings.barcodeLabelCustomHeightMm ?? 25} mm)`,
    };
  }
  return LABEL_PRESETS[key];
}

export function readBarcodeLabelFields(): BarcodeLabelFields {
  return (
    readInventorySettings().barcodeLabelFields ?? {
      itemName: true,
      barcode: true,
      sku: true,
      mrp: true,
      salePrice: true,
    }
  );
}

export function mmToIn(mm: number): number {
  return mm / 25.4;
}
