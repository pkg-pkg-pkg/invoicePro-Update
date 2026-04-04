import '../setup';
import { describe, it, expect } from 'vitest';
import { unitOfMeasureService } from '../../src/services/masters/unitOfMeasureService';
import { godownService } from '../../src/services/masters/godownService';
import { inventoryItemService } from '../../src/services/masters/inventoryItemService';
import { stockSummaryService } from '../../src/services/reports/stockSummaryService';

const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

describe('stockSummaryService.list', () => {
  it('returns item totals with godown breakup and reorder signal', async () => {
    const unit = await unitOfMeasureService.create({
      name: unique('Unit'),
      symbol: unique('U'),
      precision: 0,
    });
    const godownA = await godownService.create({
      name: unique('GodownA'),
      isDefault: true,
    });
    const godownB = await godownService.create({
      name: unique('GodownB'),
      isDefault: false,
    });

    const item = await inventoryItemService.create({
      name: unique('Item'),
      sku: unique('SKU'),
      unitId: unit.id,
      gstRate: 12,
      openingStock: 0,
      openingValue: 0,
      currentStock: 5,
      reorderLevel: 10,
      godownStocks: [
        { godownId: godownA.id, quantity: 3 },
        { godownId: godownB.id, quantity: 2 },
      ],
    });

    const summary = await stockSummaryService.list({ itemId: item.id });
    expect(summary).toHaveLength(1);
    const entry = summary[0];
    expect(entry.item.id).toBe(item.id);
    expect(entry.totalQuantity).toBeCloseTo(5, 6);
    expect(entry.belowReorder).toBe(true);
    expect(entry.godowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ godownId: godownA.id, quantity: 3 }),
        expect.objectContaining({ godownId: godownB.id, quantity: 2 }),
      ])
    );
  });
});
