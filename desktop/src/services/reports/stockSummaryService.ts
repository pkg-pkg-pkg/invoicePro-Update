import { InventoryItem, InventoryGodownStock } from '../../types/masters';
import { inventoryItemService } from '../masters/inventoryItemService';
import { godownService } from '../masters/godownService';

export interface StockSummaryFilters {
  includeInactive?: boolean;
  itemId?: string;
}

export interface StockSummaryEntry {
  item: InventoryItem;
  totalQuantity: number;
  godowns: {
    godownId: string;
    godownName?: string | null;
    quantity: number;
  }[];
  belowReorder: boolean;
}

const normalizeGodownStocks = async (stocks: InventoryGodownStock[] | undefined) => {
  if (!stocks || stocks.length === 0) {
    return [];
  }

  const godownMap = new Map<string, string | null>();
  for (const stock of stocks) {
    if (godownMap.has(stock.godownId)) continue;
    const godown = await godownService.getById(stock.godownId);
    godownMap.set(stock.godownId, godown?.name ?? null);
  }

  return stocks.map((entry) => ({
    godownId: entry.godownId,
    godownName: godownMap.get(entry.godownId) ?? null,
    quantity: entry.quantity,
  }));
};

export const stockSummaryService = {
  async list(filters: StockSummaryFilters = {}): Promise<StockSummaryEntry[]> {
    const items = await inventoryItemService.list({
      includeInactive: filters.includeInactive,
    });

    const filtered = filters.itemId ? items.filter((item) => item.id === filters.itemId) : items;

    const entries: StockSummaryEntry[] = [];
    for (const item of filtered) {
      if (!filters.includeInactive && item.status !== 'ACTIVE') {
        continue;
      }
      const totalQuantity = Number((item.currentStock ?? 0).toFixed(4));
      const belowReorder =
        item.reorderLevel !== null && item.reorderLevel !== undefined
          ? totalQuantity <= item.reorderLevel
          : false;
      const godowns = await normalizeGodownStocks(item.godownStocks);
      entries.push({
        item,
        totalQuantity,
        godowns,
        belowReorder,
      });
    }

    return entries.sort((a, b) => a.item.name.localeCompare(b.item.name));
  },
};
