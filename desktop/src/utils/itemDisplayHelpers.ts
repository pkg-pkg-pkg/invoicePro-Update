import type { InventoryItem, InventoryItemType } from '../types/masters';

const ITEM_TYPE_LABEL: Record<InventoryItemType | string, string> = {
  SALES: 'Sales Item',
  PURCHASE: 'Purchase Item',
  BOTH: 'Sales & Purchase Item',
};

export function getItemTypeLabel(itemType?: InventoryItemType | null): string {
  return ITEM_TYPE_LABEL[itemType ?? 'BOTH'] ?? 'Sales & Purchase Item';
}

export function getItemStockStatus(item: InventoryItem): { label: string; color: string } {
  const qty = Number(item.currentStock ?? 0);
  const reorder = Number(item.reorderLevel ?? 0);
  if (qty <= 0) return { label: 'Out of stock', color: '#DC2626' };
  if (reorder > 0 && qty <= reorder) return { label: 'Low stock', color: '#D97706' };
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
