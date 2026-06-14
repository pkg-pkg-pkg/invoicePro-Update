import {
  readBarcodeLabelFields,
  resolveLabelDimensions,
  mmToIn,
} from '../../services/barcode/barcodeSettings';
import type { BarcodeLabelFields } from '../../services/inventory/lowStockSettings';

/** @deprecated Use resolveLabelDimensions from barcodeSettings */
export type LabelSize = 'small' | 'medium' | 'large';

export const LABEL_SIZES: Record<LabelSize, { widthIn: number; heightIn: number; label: string }> = {
  small: { widthIn: 2, heightIn: 1, label: 'Small (2×1 in)' },
  medium: { widthIn: 3, heightIn: 2, label: 'Medium (3×2 in)' },
  large: { widthIn: 4, heightIn: 3, label: 'Large (4×3 in)' },
};

export function openBarcodePrintWindow(html: string): void {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function labelFieldRows(
  fields: BarcodeLabelFields,
  params: { itemName: string; sku?: string; price?: string; mrp?: string; barcodeText: string }
): string {
  const rows: string[] = [];
  if (fields.itemName) rows.push(`<div class="name">${params.itemName}</div>`);
  if (fields.sku && params.sku) rows.push(`<div class="sku">SKU: ${params.sku}</div>`);
  if (fields.salePrice && params.price) rows.push(`<div class="price">Sale: ₹ ${params.price}</div>`);
  if (fields.mrp && params.mrp) rows.push(`<div class="mrp">MRP: ₹ ${params.mrp}</div>`);
  if (fields.barcode) rows.push(`<div class="code">${params.barcodeText}</div>`);
  return rows.join('');
}

export function buildBarcodeLabelHtml(params: {
  imageDataUrl: string;
  itemName: string;
  sku?: string;
  price?: string;
  mrp?: string;
  barcodeText: string;
  size?: LabelSize;
  fields?: BarcodeLabelFields;
}): string {
  const dim = resolveLabelDimensions();
  const widthIn = mmToIn(dim.widthMm);
  const heightIn = mmToIn(dim.heightMm);
  const fields = params.fields ?? readBarcodeLabelFields();
  const body = labelFieldRows(fields, params);
  return `<!DOCTYPE html><html><head><title>Barcode Label</title>
<style>
@page { margin: 0.25in; }
body { font-family: Arial, sans-serif; margin: 0; padding: 12px; }
.label {
  width: ${widthIn}in; height: ${heightIn}in;
  border: 1px dashed #ccc; display: flex; flex-direction: column;
  align-items: center; justify-content: center; page-break-inside: avoid;
  margin-bottom: 8px;
}
.label img { max-width: 95%; max-height: 50%; object-fit: contain; }
.name { font-size: 11px; font-weight: 700; margin-top: 4px; text-align: center; }
.sku { font-size: 9px; color: #444; }
.price { font-size: 10px; color: #333; }
.mrp { font-size: 9px; color: #555; }
.code { font-size: 9px; color: #666; letter-spacing: 1px; }
</style></head><body>
<div class="label">
  <img src="${params.imageDataUrl}" alt="barcode" />
  ${body}
</div>
</body></html>`;
}

export function buildBulkBarcodeHtml(
  labels: Array<{ imageDataUrl: string; itemName: string; sku?: string; price?: string; mrp?: string; barcodeText: string }>,
  perSheet: 1 | 2 | 4 | 8 = 4
): string {
  const dim = resolveLabelDimensions();
  const widthIn = mmToIn(dim.widthMm);
  const heightIn = mmToIn(dim.heightMm);
  const fields = readBarcodeLabelFields();
  const cells = labels
    .map((l) => {
      const body = labelFieldRows(fields, l);
      return `<div class="label"><img src="${l.imageDataUrl}" alt="" />${body}</div>`;
    })
    .join('');
  const cols = perSheet >= 4 ? 2 : perSheet;
  return `<!DOCTYPE html><html><head><title>Barcode Labels</title>
<style>
@page { margin: 0.25in; }
body { margin: 0; font-family: Arial, sans-serif; }
.sheet { display: grid; grid-template-columns: repeat(${cols}, ${widthIn}in); gap: 8px; padding: 8px; }
.label {
  width: ${widthIn}in; height: ${heightIn}in; border: 1px dashed #ccc;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  page-break-inside: avoid;
}
.label img { max-width: 95%; max-height: 55%; object-fit: contain; }
.name { font-size: 10px; font-weight: 700; text-align: center; }
.sku, .price, .mrp { font-size: 9px; }
.code { font-size: 8px; color: #666; }
</style></head><body><div class="sheet">${cells}</div></body></html>`;
}
