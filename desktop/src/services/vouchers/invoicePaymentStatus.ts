import type { Voucher } from '../../types/vouchers';

const RECEIPT_TYPES = new Set(['RECEIPT']);
const PAYMENT_TYPES = new Set(['PAYMENT']);

export function parseInvoiceAllocations(narration?: string): Record<string, number> {
  const map: Record<string, number> = {};
  if (!narration) return map;
  const re = /INVALLOC\[(.+?)\]=(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(narration))) {
    const invoiceNumber = String(match[1] || '').trim();
    const amount = Number(match[2] || 0);
    if (!invoiceNumber || Number.isNaN(amount)) continue;
    map[invoiceNumber] = (map[invoiceNumber] ?? 0) + amount;
  }
  return map;
}

export function parseDueDateToken(narration?: string): string | undefined {
  if (!narration) return undefined;
  const m = String(narration).match(/DUE\[(\d{4}-\d{2}-\d{2})\]/i);
  return m?.[1];
}

function voucherAmount(voucher: Voucher): number {
  const debit = (voucher.lines ?? []).reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
  const credit = (voucher.lines ?? []).reduce((sum, line) => sum + Number(line.credit ?? 0), 0);
  return Number(Math.max(debit, credit).toFixed(2));
}

function partyLineForSales(voucher: Voucher) {
  return (voucher.lines ?? []).find((line) => Number(line.debit ?? 0) > 0);
}

export function computeSalesInvoicePaidAmount(
  salesVoucher: Voucher,
  allVouchers: Voucher[]
): number {
  const partyLine = partyLineForSales(salesVoucher);
  if (!partyLine?.ledgerId) return 0;
  const partyLedgerId = partyLine.ledgerId;
  const invoiceNumber = salesVoucher.number;

  const paymentVouchers = allVouchers.filter(
    (v) =>
      RECEIPT_TYPES.has(v.type) &&
      (String(v.narration || '').includes(invoiceNumber) ||
        Object.keys(parseInvoiceAllocations(v.narration)).includes(invoiceNumber))
  );

  return paymentVouchers.reduce((sum, payment) => {
    const allocMap = parseInvoiceAllocations(payment.narration);
    if (Object.keys(allocMap).length > 0) {
      return sum + Number(allocMap[invoiceNumber] ?? 0);
    }
    const paymentLine = (payment.lines ?? []).find((line) => line.ledgerId === partyLedgerId);
    return sum + Number(paymentLine?.credit ?? paymentLine?.debit ?? 0);
  }, 0);
}

export function computeSalesInvoicePaymentStatus(
  salesVoucher: Voucher,
  allVouchers: Voucher[]
): 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' {
  const partyLine = partyLineForSales(salesVoucher);
  const totalAmount = Number(partyLine?.debit ?? 0);
  if (totalAmount <= 0) return 'PENDING';

  const paid = computeSalesInvoicePaidAmount(salesVoucher, allVouchers);
  const balance = totalAmount - paid;

  if (balance <= 0.01) return 'PAID';
  if (paid > 0.01) {
    const dueDate = parseDueDateToken(salesVoucher.narration) || salesVoucher.date.slice(0, 10);
    const dueTs = new Date(dueDate).getTime();
    if (Number.isFinite(dueTs) && Date.now() > dueTs) return 'OVERDUE';
    return 'PARTIAL';
  }

  const dueDate = parseDueDateToken(salesVoucher.narration) || salesVoucher.date.slice(0, 10);
  const dueTs = new Date(dueDate).getTime();
  if (Number.isFinite(dueTs) && Date.now() > dueTs) return 'OVERDUE';
  return 'PENDING';
}

export function countPendingSalesInvoices(vouchers: Voucher[]): number {
  const sales = vouchers.filter((v) => v.type === 'SALES' && (v.status ?? 'ACTIVE') === 'ACTIVE');
  return sales.filter((v) => {
    const partyLine = partyLineForSales(v);
    const total = Number(partyLine?.debit ?? 0);
    if (total <= 0) return false;
    const paid = computeSalesInvoicePaidAmount(v, vouchers);
    return total - paid > 0.01;
  }).length;
}
