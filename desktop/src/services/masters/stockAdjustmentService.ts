import { StockAdjustment, StockAdjustmentType } from '../../types/masters';
import { generateId } from '../../utils/id';
import { godownService } from './godownService';
import { inventoryItemService } from './inventoryItemService';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_stock_adjustments';

export interface StockAdjustmentFilters {
  itemId?: string;
  type?: StockAdjustmentType;
  fromDate?: string;
  toDate?: string;
}

type AdjustmentDirection = 'INCREASE' | 'DECREASE';

const normalizeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return fallback;
  }
  return num;
};

const ensurePositive = (value: number, field: string) => {
  if (value <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
};

const ensureNonNegative = (value: number, field: string) => {
  if (value < 0) {
    throw new Error(`${field} cannot be negative`);
  }
};

const parseDate = (value: string | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return date;
};

const validateItem = async (itemId: string) => {
  const item = await inventoryItemService.getById(itemId);
  if (!item || item.status === 'INACTIVE') {
    throw new Error('Inventory item not found or inactive');
  }
  return item;
};

const validateGodown = async (godownId: string | null) => {
  if (!godownId) return null;
  const godown = await godownService.getById(godownId);
  if (!godown || godown.isActive === false) {
    throw new Error('Godown not found or inactive');
  }
  return godown;
};

const ensureSingleOpening = (adjustments: StockAdjustment[], itemId: string) => {
  const existingOpening = adjustments.find(
    (adj) => adj.itemId === itemId && adj.type === 'OPENING'
  );
  if (existingOpening) {
    throw new Error('Opening stock has already been recorded for this item');
  }
};

const filterAdjustments = (adjustments: StockAdjustment[], filters: StockAdjustmentFilters) => {
  const fromDate = parseDate(filters.fromDate);
  const toDate = parseDate(filters.toDate);

  return adjustments.filter((adj) => {
    if (filters.itemId && adj.itemId !== filters.itemId) {
      return false;
    }
    if (filters.type && adj.type !== filters.type) {
      return false;
    }
    if (fromDate) {
      const adjDate = new Date(adj.date);
      if (adjDate < fromDate) return false;
    }
    if (toDate) {
      const adjDate = new Date(adj.date);
      if (adjDate > toDate) return false;
    }
    return true;
  });
};

export const stockAdjustmentService = {
  async list(filters: StockAdjustmentFilters = {}): Promise<StockAdjustment[]> {
    const adjustments = await readList<StockAdjustment>(STORAGE_KEY);
    return filterAdjustments(adjustments, filters).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  },

  async create(
    payload: Partial<StockAdjustment>,
    options: { direction?: AdjustmentDirection } = {}
  ): Promise<StockAdjustment> {
    const adjustments = await readList<StockAdjustment>(STORAGE_KEY);

    const itemId = sanitizeString(payload.itemId ?? null);
    if (!itemId) {
      throw new Error('Item is required for stock adjustment');
    }
    await validateItem(itemId);

    const godownId = sanitizeString(payload.godownId ?? null);
    await validateGodown(godownId);

    const type: StockAdjustmentType | undefined = payload.type;
    if (type !== 'OPENING' && type !== 'ADJUSTMENT') {
      throw new Error('Invalid stock adjustment type');
    }

    const quantity = normalizeNumber(payload.quantity, 0);
    ensurePositive(quantity, 'Quantity');

    const value = normalizeNumber(payload.value, 0);
    ensureNonNegative(value, 'Value');

    const reason = sanitizeString(payload.reason ?? null);
    const date = payload.date ?? nowIso();

    if (type === 'OPENING') {
      ensureSingleOpening(adjustments, itemId);
    }

    const direction: AdjustmentDirection =
      options.direction ?? (type === 'OPENING' ? 'INCREASE' : 'INCREASE');

    if (type === 'OPENING' && direction === 'DECREASE') {
      throw new Error('Opening adjustments cannot decrease stock');
    }

    const deltaQuantity = direction === 'DECREASE' ? -quantity : quantity;

    await inventoryItemService.adjustStock(itemId, deltaQuantity, { godownId });

    const adjustment: StockAdjustment = {
      id: payload.id ?? generateId('adj'),
      itemId,
      godownId,
      type,
      quantity,
      value,
      reason,
      date,
      createdAt: payload.createdAt ?? nowIso(),
    };

    adjustments.push(adjustment);
    await writeList(STORAGE_KEY, adjustments);
    return adjustment;
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },
};
