import { billReferenceService } from '../settlement/billReferenceService';
import { ledgerAccountService } from '../masters/ledgerAccountService';

/**
 * Payment & Receipt Service
 * Bill-wise settlement uses BillReference pending amounts.
 */

export interface OutstandingInvoice {
  id: string;
  type: 'SALES' | 'PURCHASE';
  number: string;
  date: string;
  dueDate?: string;
  overdueDays?: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  partyName: string;
  partyLedgerId: string;
  isSelected: boolean;
  paymentAmount: number;
  referenceType?: string;
}

export interface PaymentData {
  partyLedgerId: string;
  partyName: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  paymentType: 'PAYMENT' | 'RECEIPT' | 'ADVANCE' | 'ADJUSTMENT';
  date: string;
  narration: string;
  totalAmount: number;
  selectedInvoices: OutstandingInvoice[];
}

const parseDueDateToken = (narration?: string): string | undefined => {
  if (!narration) return undefined;
  const m = String(narration).match(/DUE\[(\d{4}-\d{2}-\d{2})\]/i);
  return m?.[1];
};

/**
 * Fetch open bill references for a party (invoice, advance, on-account).
 */
export async function fetchOutstandingInvoices(
  partyLedgerId: string,
  partyType: 'CUSTOMER' | 'SUPPLIER'
): Promise<OutstandingInvoice[]> {
  try {
    await billReferenceService.ensureMigrated();
    const [openRefs, ledgers] = await Promise.all([
      billReferenceService.listOpenForParty(partyLedgerId),
      ledgerAccountService.list({ includeInactive: true }),
    ]);
    const partyDisplayName =
      ledgers.find((l) => l.id === partyLedgerId)?.name ?? String(partyLedgerId);

    const outstandingInvoices: OutstandingInvoice[] = [];

    for (const ref of openRefs) {
      const dueDate = ref.voucherDate;
      const dueTs = new Date(dueDate).getTime();
      const nowTs = Date.now();
      const overdueDays =
        Number.isFinite(dueTs) && nowTs > dueTs
          ? Math.floor((nowTs - dueTs) / (1000 * 60 * 60 * 24))
          : 0;

      const invoiceType: 'SALES' | 'PURCHASE' =
        partyType === 'CUSTOMER' ? 'SALES' : 'PURCHASE';

      outstandingInvoices.push({
        id: ref.id,
        type: ref.referenceType === 'NEW_REF' ? invoiceType : invoiceType,
        number: ref.referenceNo,
        date: ref.voucherDate,
        dueDate: parseDueDateToken(undefined) || ref.voucherDate,
        overdueDays,
        totalAmount: ref.originalAmount,
        paidAmount: ref.adjustedAmount,
        balanceAmount: ref.pendingAmount,
        partyName: partyDisplayName,
        partyLedgerId,
        isSelected: false,
        paymentAmount: 0,
        referenceType: ref.referenceType,
      });
    }

    return outstandingInvoices;
  } catch (error) {
    console.error('Failed to load bill references:', error);
    return [];
  }
}

/**
 * Calculate payment totals
 */
export function calculatePaymentTotals(invoices: OutstandingInvoice[]) {
  const selectedInvoices = invoices.filter((inv) => inv.isSelected && inv.paymentAmount > 0);

  const totalPayment = selectedInvoices.reduce((sum, inv) => sum + inv.paymentAmount, 0);
  const totalInvoices = selectedInvoices.length;

  return {
    totalPayment,
    totalInvoices,
    selectedInvoices,
  };
}

/**
 * Validate payment data
 */
export function validatePaymentData(data: PaymentData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.partyLedgerId) {
    errors.push('Please select a party');
  }

  if (!data.date) {
    errors.push('Payment date is required');
  }

  if (data.totalAmount <= 0) {
    errors.push('Payment amount must be greater than 0');
  }

  const selectedInvoices = data.selectedInvoices.filter((inv) => inv.isSelected && inv.paymentAmount > 0);
  if (selectedInvoices.length === 0) {
    errors.push('Please select at least one invoice to pay');
  }

  for (const invoice of selectedInvoices) {
    if (invoice.paymentAmount > invoice.balanceAmount + 0.01) {
      errors.push(`Payment amount for invoice ${invoice.number} exceeds balance amount`);
    }
  }

  const allocated = selectedInvoices.reduce((sum, inv) => sum + inv.paymentAmount, 0);
  if (allocated > data.totalAmount + 0.01) {
    errors.push('Allocated amount exceeds payment total');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Build payment voucher lines
 */
export function buildPaymentVoucherLines(data: PaymentData) {
  const lines: any[] = [];
  const { cashLedgerId } = { cashLedgerId: 'cash-ledger' };

  if (data.paymentType === 'RECEIPT') {
    lines.push({ ledgerId: cashLedgerId, debit: data.totalAmount, credit: 0 });
    lines.push({ ledgerId: data.partyLedgerId, debit: 0, credit: data.totalAmount });
  } else if (data.paymentType === 'ADVANCE') {
    lines.push({ ledgerId: cashLedgerId, debit: data.totalAmount, credit: 0 });
    lines.push({ ledgerId: data.partyLedgerId, debit: 0, credit: data.totalAmount });
  } else if (data.paymentType === 'ADJUSTMENT') {
    lines.push({ ledgerId: data.partyLedgerId, debit: data.totalAmount, credit: 0 });
    lines.push({ ledgerId: 'adjustment-ledger', debit: 0, credit: data.totalAmount });
  } else {
    lines.push({ ledgerId: data.partyLedgerId, debit: data.totalAmount, credit: 0 });
    lines.push({ ledgerId: cashLedgerId, debit: 0, credit: data.totalAmount });
  }

  return lines;
}

export async function getPartyBillOutstanding(partyLedgerId: string): Promise<number> {
  await billReferenceService.ensureMigrated();
  return billReferenceService.getPartyOutstanding(partyLedgerId);
}
