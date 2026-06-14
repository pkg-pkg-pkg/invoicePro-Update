import type { InventoryItem, InventoryItemType } from '../types/masters';
import { effectiveLowStockThreshold } from '../services/inventory/lowStockSettings';

const ITEM_TYPE_LABEL: Record<InventoryItemType | string, string> = {
  SALES: 'Sales Item',
  PURCHASE: 'Purchase Item',
  BOTH: 'Sales & Purchase Item',
};

export function getItemTypeLabel(itemType?: InventoryItemType | null): string {
  return ITEM_TYPE_LABEL[itemType ?? 'BOTH'] ?? 'Sales & Purchase Item';
}

/** Total on-hand qty — sums godown splits when present, else currentStock. */
export function getItemTotalStock(item: InventoryItem): number {
  if (item.godownStocks?.length) {
    return item.godownStocks.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  }
  return Number(item.currentStock ?? 0);
}

export function formatItemStockQuantity(qty: number, unitAbbrev?: string | null): string {
  const n = Number(qty);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted =
    Math.abs(safe - Math.round(safe)) < 0.0001 ? String(Math.round(safe)) : safe.toFixed(2);
  const unit = String(unitAbbrev ?? '').trim() || 'pcs';
  return `${formatted} ${unit}`;
}

export function getItemStockStatus(item: InventoryItem): { label: string; color: string } {
  const qty = getItemTotalStock(item);
  const threshold = effectiveLowStockThreshold(item.reorderLevel);
  if (qty <= 0) return { label: 'Out of stock', color: '#DC2626' };
  if (qty <= threshold) return { label: 'Low stock', color: '#D97706' };
  return { label: 'In stock', color: '#16A34A' };
}

export type TxDisplayStatus = 'Paid' | 'Pending' | 'Overdue' | 'Draft';

const TX_STATUS_COLORS: Record<TxDisplayStatus, string> = {
  Paid: '#16A34A',
  Pending: '#D97706',
  Overdue: '#DC2626',
  Draft: '#64748B',
};

export function getTxStatusColor(status: TxDisplayStatus): string {
  return TX_STATUS_COLORS[status];
}

export function mapVoucherTxStatus(voucherStatus: string, voucherType: string): TxDisplayStatus {
  if (voucherStatus === 'CANCELLED') return 'Draft';
  if (voucherType === 'SALES' || voucherType === 'PURCHASE') return 'Pending';
  return 'Draft';
}
