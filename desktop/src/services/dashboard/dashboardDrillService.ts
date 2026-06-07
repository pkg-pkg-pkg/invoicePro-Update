import type { Voucher } from '../../types/vouchers';
import { voucherService } from '../vouchers/voucherService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import {
  computeSalesInvoicePaymentStatus,
  parseDueDateToken,
} from '../vouchers/invoicePaymentStatus';
import { voucherGrandTotal } from '../voucherPrintBuilder';
import { stockSummaryService } from '../reports/stockSummaryService';
import { isDateWithinInclusive, normalizeToYmd, toLocalYmd } from '../../utils/dateRange';

export interface TodaySalesRow {
  id: string;
  invoiceNo: string;
  customer: string;
  amount: number;
  paymentStatus: string;
  time: string;
  editPath: string;
}

export interface TodayReceiptRow {
  id: string;
  receiptNo: string;
  customer: string;
  amount: number;
  paymentMode: string;
  time: string;
  editPath: string;
}

export type OutstandingDrillCategory = 'overdue' | 'due_today' | 'upcoming';

export interface OutstandingDrillRow {
  id: string;
  category: OutstandingDrillCategory;
  customer: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  partyLedgerId?: string;
  editPath: string;
}

export interface StockValuationRow {
  id: string;
  item: string;
  sku?: string;
  qty: number;
  rate: number;
  value: number;
}

function todayYmd(): string {
  return toLocalYmd(new Date());
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function partyNameFromVoucher(voucher: Voucher, ledgerMap: Map<string, string>): string {
  const partyLine = voucher.lines.find((l) => Number(l.debit ?? 0) > 0 || Number(l.credit ?? 0) > 0);
  if (!partyLine?.ledgerId) return '—';
  return ledgerMap.get(partyLine.ledgerId) ?? partyLine.ledgerId;
}

function paymentModeFromNarration(narration?: string): string {
  const m = String(narration || '').match(/MODE\[([^\]]+)\]/i);
  if (m?.[1]) return m[1];
  return 'Cash';
}

function classifyDueDate(dueYmd: string, today: string): OutstandingDrillCategory | null {
  if (!dueYmd) return null;
  if (dueYmd < today) return 'overdue';
  if (dueYmd === today) return 'due_today';
  return 'upcoming';
}

export async function fetchTodaySalesDrill(): Promise<TodaySalesRow[]> {
  const today = todayYmd();
  const [vouchers, ledgers] = await Promise.all([
    voucherService.list(),
    ledgerAccountService.list({ includeInactive: true }),
  ]);
  const ledgerMap = new Map(ledgers.map((l) => [l.id, l.name]));

  return vouchers
    .filter((v) => v.type === 'SALES' && v.status !== 'CANCELLED' && isDateWithinInclusive(v.date, today, today))
    .map((v) => ({
      id: v.id,
      invoiceNo: v.number,
      customer: partyNameFromVoucher(v, ledgerMap),
      amount: voucherGrandTotal(v),
      paymentStatus: computeSalesInvoicePaymentStatus(v, vouchers),
      time: formatTime(v.createdAt || v.date),
      editPath: `/sales/invoices/${v.id}`,
    }))
    .sort((a, b) => b.time.localeCompare(a.time));
}

export async function fetchTodayReceiptsDrill(): Promise<TodayReceiptRow[]> {
  const today = todayYmd();
  const [vouchers, ledgers] = await Promise.all([
    voucherService.list(),
    ledgerAccountService.list({ includeInactive: true }),
  ]);
  const ledgerMap = new Map(ledgers.map((l) => [l.id, l.name]));

  return vouchers
    .filter((v) => v.type === 'RECEIPT' && v.status !== 'CANCELLED' && isDateWithinInclusive(v.date, today, today))
    .map((v) => {
      const creditParty = v.lines.find((l) => Number(l.credit ?? 0) > 0);
      const customer = creditParty?.ledgerId ? ledgerMap.get(creditParty.ledgerId) ?? '—' : partyNameFromVoucher(v, ledgerMap);
      return {
        id: v.id,
        receiptNo: v.number,
        customer,
        amount: voucherGrandTotal(v),
        paymentMode: paymentModeFromNarration(v.narration),
        time: formatTime(v.createdAt || v.date),
        editPath: `/sales/collections/${v.id}/edit`,
      };
    })
    .sort((a, b) => b.time.localeCompare(a.time));
}

export async function fetchOutstandingDrill(): Promise<OutstandingDrillRow[]> {
  const today = todayYmd();
  const [vouchers, ledgers] = await Promise.all([
    voucherService.list(),
    ledgerAccountService.list({ includeInactive: true }),
  ]);
  const ledgerMap = new Map(ledgers.map((l) => [l.id, l.name]));
  const rows: OutstandingDrillRow[] = [];

  for (const v of vouchers) {
    if (v.type !== 'SALES' || v.status === 'CANCELLED') continue;
    const status = computeSalesInvoicePaymentStatus(v, vouchers);
    if (status === 'PAID') continue;
    const partyLine = v.lines.find((l) => Number(l.debit ?? 0) > 0);
    const dueDate = parseDueDateToken(v.narration) || normalizeToYmd(v.date);
    const category = classifyDueDate(dueDate, today);
    if (!category) continue;
    const amount = voucherGrandTotal(v);
    if (amount <= 0) continue;
    rows.push({
      id: v.id,
      category,
      customer: partyLine?.ledgerId ? ledgerMap.get(partyLine.ledgerId) ?? '—' : '—',
      invoiceNo: v.number,
      invoiceDate: normalizeToYmd(v.date),
      dueDate,
      amount,
      partyLedgerId: partyLine?.ledgerId,
      editPath: `/sales/invoices/${v.id}`,
    });
  }

  const order: Record<OutstandingDrillCategory, number> = { overdue: 0, due_today: 1, upcoming: 2 };
  return rows.sort((a, b) => order[a.category] - order[b.category] || a.dueDate.localeCompare(b.dueDate));
}

export async function fetchStockValuationDrill(): Promise<StockValuationRow[]> {
  const entries = await stockSummaryService.list({ includeInactive: false });
  return entries.map((entry) => {
    const qty = Number(entry.totalQuantity ?? 0);
    const openingStock = Number(entry.item.openingStock ?? 0);
    const rate =
      openingStock > 0
        ? Number(entry.item.openingValue ?? 0) / openingStock
        : Number(entry.item.pricing?.sale ?? entry.item.pricing?.purchase ?? 0);
    return {
      id: entry.item.id,
      item: entry.item.name,
      sku: entry.item.sku ?? undefined,
      qty,
      rate: Number(rate.toFixed(2)),
      value: Number((qty * rate).toFixed(2)),
    };
  });
}

export function exportStockValuationCsv(rows: StockValuationRow[]): void {
  const header = ['Item', 'SKU', 'Qty', 'Rate', 'Value'];
  const lines = rows.map((r) =>
    [r.item, r.sku ?? '', r.qty, r.rate, r.value].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-valuation-${todayYmd()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printStockValuationHtml(rows: StockValuationRow[], title: string): void {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.item}</td><td align="right">${r.qty}</td><td align="right">${r.rate.toFixed(2)}</td><td align="right">${r.value.toFixed(2)}</td></tr>`
    )
    .join('');
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}th{background:#eef4fb}</style>
    </head><body><h2>${title}</h2><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Value</th></tr></thead><tbody>${body}</tbody>
    <tfoot><tr><td colspan="3"><strong>Total</strong></td><td align="right"><strong>${total.toFixed(2)}</strong></td></tr></tfoot></table></body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
