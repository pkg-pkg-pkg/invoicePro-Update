/**
 * REST-style items API — wraps local inventory services (Electron/desktop).
 * Endpoints mirror: GET/POST/PUT/DELETE /api/items and /api/items/:id/transactions
 */
import { inventoryItemService } from '../masters/inventoryItemService';
import { itemHistoryService } from '../masters/itemHistoryService';
import { stockAdjustmentService } from '../masters/stockAdjustmentService';
import { voucherService } from '../vouchers/voucherService';
import type { InventoryItem } from '../../types/masters';
import type { InventoryItemFilters } from '../masters/inventoryItemService';
import type { Voucher } from '../../types/vouchers';

export type ItemTransactionRow = {
  id: string;
  date: string;
  type: string;
  number: string;
  quantity: number;
  voucherId: string;
};

export const itemsApi = {
  async list(filters: InventoryItemFilters = {}): Promise<InventoryItem[]> {
    return inventoryItemService.list(filters);
  },

  async getById(id: string): Promise<InventoryItem | null> {
    return inventoryItemService.getById(id);
  },

  async create(payload: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = await inventoryItemService.create({
      ...payload,
      createdSource: payload.createdSource ?? 'USER',
    });
    await itemHistoryService.append(item.id, 'CREATED', `Item "${item.name}" created`);
    return item;
  },

  async update(id: string, payload: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = await inventoryItemService.update(id, payload);
    await itemHistoryService.append(id, 'UPDATED', `Item "${item.name}" updated`);
    return item;
  },

  async remove(id: string): Promise<void> {
    const existing = await inventoryItemService.getById(id);
    await inventoryItemService.softDelete(id);
    if (existing) {
      await itemHistoryService.append(id, 'DELETED', `Item "${existing.name}" marked inactive`);
    }
  },

  async duplicate(id: string): Promise<InventoryItem> {
    const source = await inventoryItemService.getById(id);
    if (!source) throw new Error('Item not found');
    const copy = await inventoryItemService.create({
      ...source,
      id: undefined,
      name: `${source.name} (Copy)`,
      sku: `${source.sku}-COPY-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      barcode: null,
      openingStock: 0,
      openingValue: 0,
      currentStock: 0,
      godownStocks: [],
      createdSource: 'USER',
    });
    await itemHistoryService.append(copy.id, 'DUPLICATED', `Duplicated from "${source.name}"`);
    return copy;
  },

  async getTransactions(itemId: string): Promise<ItemTransactionRow[]> {
    const vouchers = await voucherService.list();
    const rows: ItemTransactionRow[] = [];
    for (const v of vouchers as Voucher[]) {
      v.lines.forEach((line, idx) => {
        if (line.itemId !== itemId || line.quantity === undefined) return;
        rows.push({
          id: `${v.id}-${idx}`,
          date: v.date.slice(0, 10),
          type: v.type,
          number: v.number,
          quantity: Number(line.quantity),
          voucherId: v.id,
        });
      });
    }
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  },

  async getHistory(itemId: string) {
    const [history, adjustments] = await Promise.all([
      itemHistoryService.list(itemId),
      stockAdjustmentService.list({ itemId }),
    ]);
    return { history, adjustments };
  },
};
