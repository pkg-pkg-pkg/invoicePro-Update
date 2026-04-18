import type { InventoryItem } from '../../types/masters';
import type { Voucher, VoucherLine } from '../../types/vouchers';

const isVoucherActive = (v: Voucher) => (v.status ?? 'ACTIVE') !== 'CANCELLED';

/** Sales ledger line: pre-GST revenue stored as credit with itemId (no tax bifurcation fields). */
export const isExclusiveSalesItemLine = (line: VoucherLine): boolean =>
  Boolean(line.itemId) &&
  Number(line.credit ?? 0) > 0 &&
  !line.taxType &&
  !line.chargeType &&
  line.roundOffAmount == null;

export const purchaseExclusiveFromVoucher = (v: Voucher): number => {
  if (v.type !== 'PURCHASE' || !isVoucherActive(v)) return 0;
  const candidates = (v.lines ?? []).filter(
    (l) => Number(l.debit ?? 0) > 0 && !l.itemId && !l.taxType && !l.chargeType && l.roundOffAmount == null
  );
  if (!candidates.length) return 0;
  return Number(Math.max(...candidates.map((l) => Number(l.debit ?? 0))).toFixed(2));
};

const customerLedgerFromSalesVoucher = (v: Voucher): string => {
  const cust = (v.lines ?? []).find((l) => Number(l.debit ?? 0) > 0 && !l.itemId && !l.taxType);
  return cust?.ledgerId ?? '—';
};

export type ItemProfitRow = {
  itemId: string;
  itemName: string;
  qtyOut: number;
  revenueExGst: number;
  costAtMasterPurchaseExGst: number;
  profitExGst: number;
};

export type BillProfitRow = {
  voucherId: string;
  number: string;
  date: string;
  customerLedgerId: string;
  revenueExGst: number;
  costAtMasterPurchaseExGst: number;
  profitExGst: number;
};

export type CustomerProfitRow = {
  customerLedgerId: string;
  revenueExGst: number;
  costAtMasterPurchaseExGst: number;
  profitExGst: number;
};

export function buildPreGstTradingProfit(
  vouchers: Voucher[],
  items: InventoryItem[]
): { byItem: ItemProfitRow[]; byBill: BillProfitRow[]; byCustomer: CustomerProfitRow[] } {
  const purchaseRate = new Map<string, number>();
  items.forEach((it) => {
    const p = Number(it.pricing?.purchase ?? 0);
    purchaseRate.set(it.id, Number.isFinite(p) ? p : 0);
  });
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  const itemMap = new Map<string, { qty: number; rev: number; cost: number }>();
  const billMap = new Map<string, BillProfitRow>();
  const custMap = new Map<string, { rev: number; cost: number }>();

  for (const v of vouchers) {
    if (v.type !== 'SALES' || !isVoucherActive(v)) continue;
    const customerLedgerId = customerLedgerFromSalesVoucher(v);
    let billRev = 0;
    let billCost = 0;

    for (const line of v.lines ?? []) {
      if (!isExclusiveSalesItemLine(line)) continue;
      const itemId = line.itemId as string;
      const qty = Number(line.quantity ?? 0) || 0;
      const rev = Number(line.credit ?? 0) || 0;
      const rate = purchaseRate.get(itemId) ?? 0;
      const cost = qty * rate;

      const cur = itemMap.get(itemId) ?? { qty: 0, rev: 0, cost: 0 };
      cur.qty += qty;
      cur.rev += rev;
      cur.cost += cost;
      itemMap.set(itemId, cur);

      billRev += rev;
      billCost += cost;
    }

    if (billRev > 0 || billCost > 0) {
      billMap.set(v.id, {
        voucherId: v.id,
        number: v.number,
        date: v.date,
        customerLedgerId,
        revenueExGst: Number(billRev.toFixed(2)),
        costAtMasterPurchaseExGst: Number(billCost.toFixed(2)),
        profitExGst: Number((billRev - billCost).toFixed(2)),
      });
      const c = custMap.get(customerLedgerId) ?? { rev: 0, cost: 0 };
      c.rev += billRev;
      c.cost += billCost;
      custMap.set(customerLedgerId, c);
    }
  }

  const byItem: ItemProfitRow[] = Array.from(itemMap.entries()).map(([itemId, v]) => ({
    itemId,
    itemName: nameOf(itemId),
    qtyOut: Number(v.qty.toFixed(4)),
    revenueExGst: Number(v.rev.toFixed(2)),
    costAtMasterPurchaseExGst: Number(v.cost.toFixed(2)),
    profitExGst: Number((v.rev - v.cost).toFixed(2)),
  }));
  byItem.sort((a, b) => b.profitExGst - a.profitExGst);

  const byBill = Array.from(billMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  const byCustomer: CustomerProfitRow[] = Array.from(custMap.entries()).map(([customerLedgerId, v]) => ({
    customerLedgerId,
    revenueExGst: Number(v.rev.toFixed(2)),
    costAtMasterPurchaseExGst: Number(v.cost.toFixed(2)),
    profitExGst: Number((v.rev - v.cost).toFixed(2)),
  }));
  byCustomer.sort((a, b) => b.profitExGst - a.profitExGst);

  return { byItem, byBill, byCustomer };
}

/** Sum of purchase subtotals (pre-GST) from active purchase vouchers. */
export function sumPurchaseExclusivePreGst(vouchers: Voucher[]): number {
  let sum = 0;
  for (const v of vouchers) {
    if (v.type !== 'PURCHASE' || !isVoucherActive(v)) continue;
    sum += purchaseExclusiveFromVoucher(v);
  }
  return Number(sum.toFixed(2));
}

export function sumSalesItemExclusiveRevenue(vouchers: Voucher[]): number {
  let sum = 0;
  for (const v of vouchers) {
    if (v.type !== 'SALES' || !isVoucherActive(v)) continue;
    for (const line of v.lines ?? []) {
      if (isExclusiveSalesItemLine(line)) {
        sum += Number(line.credit ?? 0);
      }
    }
  }
  return Number(sum.toFixed(2));
}
