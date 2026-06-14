import type { InventoryItem } from '../../types/masters';
import { effectiveLowStockThreshold } from './lowStockSettings';

export type LowStockRow = InventoryItem & {
  threshold: number;
  reorderQty: number;
  severity: 'out' | 'critical' | 'low';
};

export function classifyLowStock(item: InventoryItem): LowStockRow | null {
  const threshold = effectiveLowStockThreshold(item.reorderLevel);
  const stock = Number(item.currentStock ?? 0);
  if (stock > threshold) return null;

  let severity: LowStockRow['severity'] = 'low';
  if (stock <= 0) severity = 'out';
  else if (stock < 5) severity = 'critical';

  return {
    ...item,
    threshold,
    reorderQty: Math.max(0, threshold - stock),
    severity,
  };
}

export function listLowStockItems(items: InventoryItem[]): LowStockRow[] {
  return items
    .filter((i) => i.status === 'ACTIVE')
    .map(classifyLowStock)
    .filter((r): r is LowStockRow => r != null)
    .sort((a, b) => a.currentStock - b.currentStock || a.name.localeCompare(b.name));
}
