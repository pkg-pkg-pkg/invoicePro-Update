import { InventoryItem } from '../../types/masters';
import { Voucher, VoucherType } from '../../types/vouchers';
import { inventoryItemService } from '../masters/inventoryItemService';
import { godownService } from '../masters/godownService';

type ImpactDirection = -1 | 1;

const stockDirections: Partial<Record<VoucherType, ImpactDirection>> = {
  SALES: -1,
  SALES_RETURN: 1,
  PURCHASE: 1,
  PURCHASE_RETURN: -1,
};
const enforceStockAvailabilityTypes: VoucherType[] = ['PURCHASE_RETURN'];

interface PendingAdjustment {
  itemId: string;
  godownId: string;
  delta: number;
}

const resolveGodown = async (lineGodownId: string | undefined, item: InventoryItem, lineIndex: number) => {
  if (lineGodownId) {
    const godown = await godownService.getById(lineGodownId);
    if (!godown || godown.isActive === false) {
      throw new Error(`Godown not found or inactive on line ${lineIndex + 1}`);
    }
    return godown.id;
  }

  if (item.godownStocks && item.godownStocks.length === 1) {
    return item.godownStocks[0].godownId;
  }

  throw new Error(`Godown is required for stock impact on line ${lineIndex + 1}`);
};

const ensureSufficientStock = (item: InventoryItem, godownId: string, quantity: number, lineIndex: number) => {
  const godownStock = item.godownStocks?.find((stock) => stock.godownId === godownId);
  const available = godownStock?.quantity ?? 0;
  if (available < quantity) {
    const negativeBy = Number((quantity - available).toFixed(2));
    throw new Error(
      `Line ${lineIndex + 1}: ${item.name} stock in selected godown is ${available}, requested ${quantity}, negative by ${negativeBy}`
    );
  }
};

export async function applyStockImpact(voucher: Voucher): Promise<void> {
  const direction = stockDirections[voucher.type];
  if (!direction) {
    return;
  }

  if (!Array.isArray(voucher.lines) || voucher.lines.length === 0) {
    throw new Error('Voucher lines are required for stock impact');
  }

  const adjustments: PendingAdjustment[] = [];

  for (let i = 0; i < voucher.lines.length; i += 1) {
    const line = voucher.lines[i];
    if (!line.itemId && line.quantity === undefined) {
      continue;
    }

    if (!line.itemId || line.quantity === undefined) {
      throw new Error(`Item and quantity are required for stock impact on line ${i + 1}`);
    }

    const quantity = Number(line.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      throw new Error(`Quantity must be greater than zero on line ${i + 1}`);
    }

    const item = await inventoryItemService.getById(line.itemId);
    if (!item || item.status !== 'ACTIVE') {
      throw new Error(`Inventory item not found or inactive on line ${i + 1}`);
    }

    const godownId = await resolveGodown(line.godownId, item, i);

    if (direction < 0 && enforceStockAvailabilityTypes.includes(voucher.type)) {
      ensureSufficientStock(item, godownId, quantity, i);
    }

    const delta = Number((direction * quantity).toFixed(4));
    adjustments.push({ itemId: item.id, godownId, delta });
  }

  if (!adjustments.length) {
    throw new Error('Stock-impact vouchers require at least one item line with quantity');
  }

  for (const adjustment of adjustments) {
    await inventoryItemService.adjustStock(adjustment.itemId, adjustment.delta, {
      godownId: adjustment.godownId,
      allowNegative: voucher.type === 'SALES',
    });
  }
}

export async function reverseStockImpact(voucher: Voucher): Promise<void> {
  const direction = stockDirections[voucher.type];
  if (!direction) return;
  if (!Array.isArray(voucher.lines) || voucher.lines.length === 0) return;

  for (let i = 0; i < voucher.lines.length; i += 1) {
    const line = voucher.lines[i];
    if (!line.itemId || line.quantity === undefined) continue;
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const item = await inventoryItemService.getById(line.itemId);
    if (!item || item.status !== 'ACTIVE') continue;
    const godownId = await resolveGodown(line.godownId, item, i);
    const reverseDelta = Number((-direction * quantity).toFixed(4));
    await inventoryItemService.adjustStock(item.id, reverseDelta, {
      godownId,
      allowNegative: true,
    });
  }
}
