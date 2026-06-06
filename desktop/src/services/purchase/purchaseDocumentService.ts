import type { PurchaseDocKind, PurchaseDocumentRow } from '../../types/purchaseDocuments';
import type { SalesDocumentStatus } from '../../types/salesDocuments';
import { voucherService } from '../vouchers/voucherService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { voucherGrandTotal } from '../voucherPrintBuilder';
import { parseDueDateToken } from '../vouchers/invoicePaymentStatus';
import type { Voucher } from '../../types/vouchers';
import { readList } from '../masters/storageHelpers';

function partyFromVoucher(voucher: Voucher, ledgerMap: Map<string, string>): { id?: string; name: string } {
  const partyLine = voucher.lines.find((l) => Number(l.debit ?? 0) > 0 || Number(l.credit ?? 0) > 0);
  const id = partyLine?.ledgerId;
  return { id, name: (id && ledgerMap.get(id)) || '—' };
}

function voucherGstTotal(voucher: Voucher): number {
  return (voucher.lines ?? []).reduce(
    (sum, line) =>
      sum + Number(line.cgstAmount ?? 0) + Number(line.sgstAmount ?? 0) + Number(line.igstAmount ?? 0),
    0
  );
}

function purchaseBillBalanceDue(voucher: Voucher, allVouchers: Voucher[]): number {
  const partyLine = (voucher.lines ?? []).find((line) => Number(line.credit ?? 0) > 0);
  const total = Number(partyLine?.credit ?? 0);
  if (total <= 0) return 0;

  const invoiceNumber = voucher.number;
  const paid = allVouchers
    .filter((v) => v.type === 'PAYMENT')
    .reduce((sum, payment) => {
      if (!String(payment.narration || '').includes(invoiceNumber)) return sum;
      const paymentLine = (payment.lines ?? []).find((line) => line.ledgerId === partyLine?.ledgerId);
      return sum + Number(paymentLine?.debit ?? paymentLine?.credit ?? 0);
    }, 0);

  return Math.max(0, Number((total - paid).toFixed(2)));
}

function mapPurchaseBillStatus(voucher: Voucher, allVouchers: Voucher[]): SalesDocumentStatus {
  if ((voucher.status ?? 'ACTIVE') === 'CANCELLED') return 'CANCELLED';
  const balance = purchaseBillBalanceDue(voucher, allVouchers);
  if (balance <= 0.01) return 'PAID';
  const dueDate = parseDueDateToken(voucher.narration) || voucher.date.slice(0, 10);
  if (new Date(dueDate).getTime() < Date.now()) return 'OVERDUE';
  return 'APPROVED';
}

type StoredExpense = {
  id: string;
  date: string;
  amount: number;
  description?: string;
  referenceNumber?: string;
  status?: string;
};

async function purchaseBillRows(vouchers: Voucher[], ledgerMap: Map<string, string>): Promise<PurchaseDocumentRow[]> {
  return vouchers
    .filter((v) => v.type === 'PURCHASE')
    .map((v) => {
      const party = partyFromVoucher(v, ledgerMap);
      return {
        id: v.id,
        kind: 'purchase-bills' as const,
        number: v.number,
        date: v.date.slice(0, 10),
        vendorId: party.id,
        vendorName: party.name,
        amount: voucherGrandTotal(v),
        gstAmount: voucherGstTotal(v),
        balanceDue: purchaseBillBalanceDue(v, vouchers),
        status: mapPurchaseBillStatus(v, vouchers),
        dueDate: parseDueDateToken(v.narration) ?? v.date.slice(0, 10),
        source: 'voucher' as const,
        editPath: `/vouchers/purchase/${v.id}/edit`,
      };
    });
}

async function vendorPaymentRows(vouchers: Voucher[], ledgerMap: Map<string, string>): Promise<PurchaseDocumentRow[]> {
  return vouchers
    .filter((v) => v.type === 'PAYMENT')
    .map((v) => {
      const party = partyFromVoucher(v, ledgerMap);
      return {
        id: v.id,
        kind: 'vendor-payments' as const,
        number: v.number,
        date: v.date.slice(0, 10),
        vendorId: party.id,
        vendorName: party.name,
        amount: voucherGrandTotal(v),
        gstAmount: 0,
        balanceDue: 0,
        status: (v.status ?? 'ACTIVE') === 'CANCELLED' ? ('CANCELLED' as const) : ('PAID' as const),
        source: 'voucher' as const,
        editPath: `/vouchers/payment-vouchers/${v.id}/edit`,
      };
    });
}

async function debitNoteRows(vouchers: Voucher[], ledgerMap: Map<string, string>): Promise<PurchaseDocumentRow[]> {
  return vouchers
    .filter((v) => v.type === 'PURCHASE_RETURN')
    .map((v) => {
      const party = partyFromVoucher(v, ledgerMap);
      return {
        id: v.id,
        kind: 'debit-notes' as const,
        number: v.number,
        date: v.date.slice(0, 10),
        vendorId: party.id,
        vendorName: party.name,
        amount: voucherGrandTotal(v),
        gstAmount: voucherGstTotal(v),
        balanceDue: 0,
        status: (v.status ?? 'ACTIVE') === 'CANCELLED' ? ('CANCELLED' as const) : ('APPROVED' as const),
        source: 'voucher' as const,
        editPath: `/vouchers/purchase-return/${v.id}/edit`,
      };
    });
}

async function expenseRows(): Promise<PurchaseDocumentRow[]> {
  const rows = await readList<StoredExpense>('expenses');
  return rows.map((e) => ({
    id: e.id,
    kind: 'expenses' as const,
    number: e.referenceNumber || e.id.slice(0, 8).toUpperCase(),
    date: e.date.slice(0, 10),
    vendorName: e.description || 'Expense',
    amount: Number(e.amount ?? 0),
    gstAmount: 0,
    balanceDue: 0,
    status: 'PAID' as const,
    source: 'expense' as const,
    editPath: '/expenses',
  }));
}

export const purchaseDocumentService = {
  async listByKind(kind: PurchaseDocKind): Promise<PurchaseDocumentRow[]> {
    const [vouchers, ledgers] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: false }),
    ]);
    const ledgerMap = new Map(ledgers.map((l) => [l.id, l.name]));

    switch (kind) {
      case 'purchase-bills':
        return purchaseBillRows(vouchers, ledgerMap);
      case 'vendor-payments':
        return vendorPaymentRows(vouchers, ledgerMap);
      case 'debit-notes':
        return debitNoteRows(vouchers, ledgerMap);
      case 'expenses':
        return expenseRows();
      default:
        return [];
    }
  },
};
