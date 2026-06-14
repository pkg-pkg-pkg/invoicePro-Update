import { useCallback, useEffect, useState } from 'react';
import type { InventoryItem } from '../types/masters';
import { findItemsByBarcode } from '../services/barcode/barcodeLookup';
import { readBarcodeScanMode } from '../services/barcode/barcodeSettings';
import { playScanBeep } from '../services/barcode/scanBeep';
import { trackFeatureUsage } from '../services/privacy/featureAnalyticsService';
import { useBarcodeWedge } from '../hooks/useBarcodeWedge';

export type ScanToastState = {
  item: InventoryItem;
  quantity: number;
  rate: number;
  mode: 'sale' | 'purchase';
};

type BaseLine = { lineId: string; itemId: string; quantity: string };

export type VoucherScanConfig<TLine extends BaseLine> = {
  inventoryItems: InventoryItem[];
  lines: TLine[];
  setLines: React.Dispatch<React.SetStateAction<TLine[]>>;
  mode: 'sale' | 'purchase';
  getRate: (item: InventoryItem) => number;
  buildLineFromItem: (item: InventoryItem, template: TLine) => TLine;
  createEmptyLine: () => TLine;
  isLineValid: (line: TLine) => boolean;
  wedgeBlocked?: () => boolean;
  onNotFound: (barcode: string) => void;
  onAmbiguous?: (barcode: string, matches: InventoryItem[]) => void;
};

function moveToTop<TLine extends BaseLine>(lines: TLine[], lineId: string): TLine[] {
  const idx = lines.findIndex((l) => l.lineId === lineId);
  if (idx <= 0) return lines;
  const next = [...lines];
  const [row] = next.splice(idx, 1);
  next.unshift(row);
  return next;
}

export function useVoucherBarcodeScan<TLine extends BaseLine>(config: VoucherScanConfig<TLine>) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [highlightLineId, setHighlightLineId] = useState<string | null>(null);
  const [toast, setToast] = useState<ScanToastState | null>(null);
  const [qtyPromptItem, setQtyPromptItem] = useState<InventoryItem | null>(null);

  const placeItem = useCallback(
    (item: InventoryItem, addQty = 1) => {
      const qtyDelta = Math.max(0.0001, addQty);
      let nextQty = qtyDelta;

      config.setLines((prev) => {
        const existing = prev.findIndex((l) => l.itemId === item.id);
        if (existing >= 0) {
          const row = prev[existing];
          nextQty = (Number(row.quantity) || 0) + qtyDelta;
          const updated = { ...row, quantity: String(nextQty) };
          const rest = prev.filter((_, i) => i !== existing);
          setHighlightLineId(updated.lineId);
          return [updated, ...rest];
        }

        let next = [...prev];
        let targetIdx = next.findIndex((line) => !line.itemId);
        if (targetIdx < 0) {
          const lastIdx = next.length - 1;
          const last = next[lastIdx];
          if (config.isLineValid(last)) {
            next.push(config.createEmptyLine());
            targetIdx = next.length - 1;
          } else {
            targetIdx = lastIdx;
          }
        }
        const filled = config.buildLineFromItem(item, next[targetIdx]);
        filled.quantity = String(qtyDelta);
        nextQty = qtyDelta;
        next[targetIdx] = filled;
        setHighlightLineId(filled.lineId);
        return moveToTop(next, filled.lineId);
      });

      playScanBeep();
      trackFeatureUsage('barcodeScan');
      setToast({
        item,
        quantity: nextQty,
        rate: config.getRate(item),
        mode: config.mode,
      });
    },
    [config]
  );

  useEffect(() => {
    if (!highlightLineId) return;
    const t = window.setTimeout(() => setHighlightLineId(null), 1000);
    return () => window.clearTimeout(t);
  }, [highlightLineId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleScannedBarcode = useCallback(
    (raw: string) => {
      const scanned = raw.trim();
      if (!scanned) return;
      const matches = findItemsByBarcode(config.inventoryItems, scanned);
      if (matches.length === 1) {
        const item = matches[0];
        if (readBarcodeScanMode() === 'ASK_QUANTITY') {
          setQtyPromptItem(item);
          return;
        }
        placeItem(item, 1);
        return;
      }
      if (matches.length > 1) {
        config.onAmbiguous?.(scanned, matches);
        return;
      }
      config.onNotFound(scanned);
    },
    [config, placeItem]
  );

  useBarcodeWedge({
    enabled: true,
    onScan: handleScannedBarcode,
    isBlocked: () => Boolean(qtyPromptItem) || Boolean(config.wedgeBlocked?.()),
  });

  const confirmQtyPrompt = useCallback(
    (qty: number) => {
      if (qtyPromptItem) placeItem(qtyPromptItem, qty);
      setQtyPromptItem(null);
    },
    [placeItem, qtyPromptItem]
  );

  const cancelQtyPrompt = useCallback(() => setQtyPromptItem(null), []);

  return {
    scannerOpen,
    setScannerOpen,
    highlightLineId,
    toast,
    handleScannedBarcode,
    placeItem,
    qtyPromptItem,
    confirmQtyPrompt,
    cancelQtyPrompt,
  };
}
