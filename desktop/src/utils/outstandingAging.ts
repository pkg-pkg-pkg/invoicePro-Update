import type {
  AgingSaleVoucher,
  CustomerSummary,
  TransactionInvoice,
} from '../types/dashboard';
import type { BillReference } from '../types/billReference';

export interface AgingLineItem {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  daysOld: number;
  /** Ledger account id for party contact lookup. */
  partyLedgerId?: string;
}

export interface AgingBucket {
  label: string;
  value: number;
  items: AgingLineItem[];
}

const BUCKET_LABELS = ['0-30 Days', '31-60 Days', '61-90 Days', '91-180 Days', '180+ Days'] as const;

function daysSince(isoDate: string): number {
  const raw = String(isoDate || '').slice(0, 10);
  if (!raw) return 0;
  const d = new Date(raw);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
}

function bucketIndex(days: number): number {
  if (days <= 30) return 0;
  if (days <= 60) return 1;
  if (days <= 90) return 2;
  if (days <= 180) return 3;
  return 4;
}

function emptyBuckets(): AgingBucket[] {
  return BUCKET_LABELS.map((label) => ({ label, value: 0, items: [] }));
}

function distributeProportionally(total: number): AgingBucket[] {
  const ratios = [0.45, 0.25, 0.15, 0.1, 0.05];
  return BUCKET_LABELS.map((label, i) => ({
    label,
    value: Number((total * ratios[i]).toFixed(2)),
    items: [],
  }));
}

function pushLine(
  buckets: AgingBucket[],
  idx: number,
  item: AgingLineItem
): void {
  buckets[idx].value += item.amount;
  buckets[idx].items.push(item);
}

function isUnpaidInvoice(inv: TransactionInvoice): boolean {
  const s = String(inv.paymentStatus || '').toUpperCase();
  return s !== 'PAID';
}

/** Age-wise outstanding from open bill references (Tally bill-wise). */
function buildFromBillReferences(
  customers: CustomerSummary[],
  billReferences: BillReference[],
  ledgerNameById?: Map<string, string>
): AgingBucket[] {
  const buckets = emptyBuckets();
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  for (const ref of billReferences) {
    const pending = Number(ref.pendingAmount || 0);
    if (pending <= 0.01) continue;
    const daysOld = daysSince(ref.voucherDate);
    const idx = bucketIndex(daysOld);
    const partyName = customerMap.get(ref.partyId) ?? ledgerNameById?.get(ref.partyId) ?? '—';
    const typeLabel =
      ref.referenceType === 'NEW_REF'
        ? 'Invoice'
        : ref.referenceType === 'ADVANCE'
          ? 'Advance'
          : 'On Account';
    pushLine(buckets, idx, {
      id: ref.id,
      title: partyName,
      subtitle: `${typeLabel} ${ref.referenceNo} · ${daysOld}d`,
      amount: pending,
      daysOld,
      partyLedgerId: ref.partyId,
    });
  }

  return buckets;
}

/** FIFO age-wise outstanding from party balances + sales vouchers. */
function buildFromCustomersFifo(
  customers: CustomerSummary[],
  salesVouchers: AgingSaleVoucher[]
): AgingBucket[] {
  const buckets = emptyBuckets();
  const salesByParty = new Map<string, AgingSaleVoucher[]>();

  for (const sale of salesVouchers) {
    const list = salesByParty.get(sale.partyLedgerId) ?? [];
    list.push(sale);
    salesByParty.set(sale.partyLedgerId, list);
  }

  for (const c of customers) {
    let remaining = Number(c.currentBalance || 0);
    if (remaining <= 0) continue;

    const partySales = [...(salesByParty.get(c.id) ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    for (const sale of partySales) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, sale.amount);
      if (alloc <= 0) continue;
      const daysOld = daysSince(sale.date);
      const idx = bucketIndex(daysOld);
      const invNo = sale.invoiceNumber?.trim() || '—';
      pushLine(buckets, idx, {
        id: sale.id,
        title: c.name,
        subtitle: `Invoice ${invNo} · ${daysOld}d overdue`,
        amount: alloc,
        daysOld,
        partyLedgerId: c.id,
      });
      remaining = Number((remaining - alloc).toFixed(2));
    }

    if (remaining > 0) {
      const daysOld = partySales.length ? daysSince(partySales[0].date) : 91;
      const idx = bucketIndex(daysOld);
      pushLine(buckets, idx, {
        id: `ledger-${c.id}`,
        title: c.name,
        subtitle: partySales.length ? 'Balance after invoices' : 'Ledger outstanding',
        amount: remaining,
        daysOld,
        partyLedgerId: c.id,
      });
    }
  }

  return buckets;
}

/** Age-wise outstanding; prefers party FIFO, then unpaid invoices, then KPI estimate. */
export function buildOutstandingAging(params: {
  customers: CustomerSummary[];
  salesVouchers?: AgingSaleVoucher[];
  invoices?: TransactionInvoice[];
  fallbackTotal?: number;
  billReferences?: BillReference[];
  ledgerNameById?: Map<string, string>;
}): { buckets: AgingBucket[]; total: number } {
  const customers = (params.customers ?? []).filter((c) => Number(c.currentBalance) > 0);
  const salesVouchers = params.salesVouchers ?? [];
  const billReferences = (params.billReferences ?? []).filter((r) => Number(r.pendingAmount) > 0.01);

  if (billReferences.length > 0) {
    const buckets = buildFromBillReferences(customers, billReferences, params.ledgerNameById);
    const total = buckets.reduce((s, b) => s + b.value, 0);
    if (total > 0) {
      return {
        buckets: buckets.map((b) => ({
          ...b,
          value: Number(b.value.toFixed(2)),
          items: b.items.sort((a, b2) => b2.amount - a.amount),
        })),
        total: Number(total.toFixed(2)),
      };
    }
  }

  if (customers.length > 0 && salesVouchers.length > 0) {
    const buckets = buildFromCustomersFifo(customers, salesVouchers);
    const total = buckets.reduce((s, b) => s + b.value, 0);
    if (total > 0) {
      return {
        buckets: buckets.map((b) => ({
          ...b,
          value: Number(b.value.toFixed(2)),
          items: b.items.sort((a, b2) => b2.amount - a.amount),
        })),
        total: Number(total.toFixed(2)),
      };
    }
  }

  if (customers.length > 0) {
    const buckets = emptyBuckets();
    for (const c of customers) {
      const amount = Number(c.currentBalance || 0);
      if (amount <= 0) continue;
      const daysOld = 91;
      const idx = bucketIndex(daysOld);
      pushLine(buckets, idx, {
        id: `ledger-${c.id}`,
        title: c.name,
        subtitle: 'Ledger outstanding',
        amount,
        daysOld,
        partyLedgerId: c.id,
      });
    }
    const total = buckets.reduce((s, b) => s + b.value, 0);
    if (total > 0) {
      return {
        buckets: buckets.map((b) => ({
          ...b,
          value: Number(b.value.toFixed(2)),
          items: b.items.sort((a, b2) => b2.amount - a.amount),
        })),
        total: Number(total.toFixed(2)),
      };
    }
  }

  const buckets = emptyBuckets();
  const invoices = params.invoices ?? [];

  for (const inv of invoices) {
    if (!isUnpaidInvoice(inv)) continue;
    const amount = Number(inv.grandTotal || 0);
    if (amount <= 0) continue;
    const daysOld = daysSince(inv.date);
    const idx = bucketIndex(daysOld);
    const party =
      (inv as { partyName?: string; party?: string }).partyName ||
      (inv as { party?: string }).party ||
      '—';
    const invNo = inv.invoiceNumber?.trim() || '—';
    pushLine(buckets, idx, {
      id: inv.id,
      title: party,
      subtitle: `Invoice ${invNo} · ${daysOld}d overdue`,
      amount,
      daysOld,
    });
  }

  let total = buckets.reduce((s, b) => s + b.value, 0);

  if (total <= 0) {
    const fallback = Number(params.fallbackTotal || 0);
    if (fallback > 0) {
      const distributed = distributeProportionally(fallback);
      return { buckets: distributed, total: fallback };
    }
  }

  return {
    buckets: buckets.map((b) => ({
      ...b,
      value: Number(b.value.toFixed(2)),
      items: b.items.sort((a, b2) => b2.amount - a.amount),
    })),
    total: Number(total.toFixed(2)),
  };
}
