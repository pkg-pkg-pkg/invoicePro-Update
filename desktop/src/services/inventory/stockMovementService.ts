import { generateId } from '../../utils/id';
import { nowIso, readList, writeList } from '../masters/storageHelpers';
import { companyScopedKey } from '../../utils/companyStorage';

const STORAGE_KEY = companyScopedKey('pve_stock_movements');

export type StockMovementType =
  | 'sale'
  | 'purchase'
  | 'adjustment'
  | 'transfer'
  | 'damaged';

export interface StockMovement {
  id: string;
  itemId: string;
  movementType: StockMovementType;
  qtyChange: number;
  balanceAfter: number;
  voucherId?: string | null;
  voucherType?: string | null;
  godownId?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export const stockMovementService = {
  async list(itemId?: string): Promise<StockMovement[]> {
    const rows = await readList<StockMovement>(STORAGE_KEY);
    if (!itemId) return rows;
    return rows.filter((r) => r.itemId === itemId);
  },

  async append(entry: Omit<StockMovement, 'id' | 'createdAt'>): Promise<StockMovement> {
    const rows = await readList<StockMovement>(STORAGE_KEY);
    const row: StockMovement = {
      ...entry,
      id: generateId('stk-mv'),
      createdAt: nowIso(),
    };
    await writeList(STORAGE_KEY, [row, ...rows]);
    return row;
  },
};
