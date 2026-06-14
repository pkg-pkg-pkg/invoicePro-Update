import type { InventoryItem } from '../../types/masters';
import { itemHistoryService } from '../masters/itemHistoryService';
import { formatAdditionalBarcodesForExport } from './barcodeValidation';
import { normalizeBarcodeKey } from './barcodeUniqueness';

function sortedKeys(codes: string[] | null | undefined): string[] {
  return (codes ?? []).map((c) => normalizeBarcodeKey(c)).sort();
}

function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const sa = sortedKeys(a);
  const sb = sortedKeys(b);
  if (sa.length !== sb.length) return false;
  return sa.every((v, i) => v === sb[i]);
}

function formatBarcodeAuditSummary(params: {
  oldBarcode: string | null;
  newBarcode: string | null;
  oldAdditional: string[];
  newAdditional: string[];
  reason?: string | null;
}): string {
  const parts: string[] = [];
  const oldP = params.oldBarcode?.trim() || '—';
  const newP = params.newBarcode?.trim() || '—';
  if (oldP !== newP) {
    parts.push(`Primary barcode: ${oldP} → ${newP}`);
  }
  const oldA = formatAdditionalBarcodesForExport(params.oldAdditional) || '—';
  const newA = formatAdditionalBarcodesForExport(params.newAdditional) || '—';
  if (!arraysEqual(params.oldAdditional, params.newAdditional)) {
    parts.push(`Additional barcodes: ${oldA} → ${newA}`);
  }
  let summary = parts.length ? parts.join('. ') : 'Barcode updated';
  if (params.reason?.trim()) {
    summary += ` (Reason: ${params.reason.trim()})`;
  }
  return summary;
}

export async function recordBarcodeChangesIfNeeded(
  before: InventoryItem | null,
  after: InventoryItem,
  opts: { reason?: string | null; source?: string } = {}
): Promise<void> {
  const oldBarcode = before?.barcode ?? null;
  const newBarcode = after.barcode ?? null;
  const oldAdditional = before?.additionalBarcodes ?? [];
  const newAdditional = after.additionalBarcodes ?? [];

  const primaryChanged =
    normalizeBarcodeKey(String(oldBarcode ?? '')) !== normalizeBarcodeKey(String(newBarcode ?? ''));
  const additionalChanged = !arraysEqual(oldAdditional, newAdditional);

  if (!before) {
    if (!newBarcode?.trim() && !newAdditional.length) return;
  } else if (!primaryChanged && !additionalChanged) {
    return;
  }

  const reason = opts.reason?.trim() || opts.source || null;
  const summary = formatBarcodeAuditSummary({
    oldBarcode,
    newBarcode,
    oldAdditional,
    newAdditional,
    reason,
  });

  await itemHistoryService.append(after.id, 'BARCODE_CHANGED', summary, {
    oldBarcode,
    newBarcode,
    oldAdditionalBarcodes: oldAdditional,
    newAdditionalBarcodes: newAdditional,
    reason,
  });
}
