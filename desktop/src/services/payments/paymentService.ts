/**
 * Payment & Receipt Service
 * Handles fetching outstanding invoices and payment processing
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

const parseInvoiceAllocations = (narration?: string): Record<string, number> => {
  const map: Record<string, number> = {};
  if (!narration) return map;

  // Format created by our voucher UI:
  // INVALLOC[<invoiceNumber>]=<amount>
  const re = /INVALLOC\[(.+?)\]=(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(narration))) {
    const invoiceNumber = match[1];
    const amount = Number(match[2]);
    if (!invoiceNumber) continue;
    if (Number.isNaN(amount)) continue;
    map[invoiceNumber] = (map[invoiceNumber] ?? 0) + amount;
  }

  return map;
};

const parseDueDateToken = (narration?: string): string | undefined => {
  if (!narration) return undefined;
  const m = String(narration).match(/DUE\[(\d{4}-\d{2}-\d{2})\]/i);
  return m?.[1];
};

/**
 * Fetch outstanding invoices for a party
 */
export async function fetchOutstandingInvoices(
  partyLedgerId: string, 
  partyType: 'CUSTOMER' | 'SUPPLIER'
): Promise<OutstandingInvoice[]> {
  // For now, use local storage calculation only
  // Backend API endpoint doesn't exist yet
  try {
    const vouchers = JSON.parse(localStorage.getItem('pve_vouchers') || '[]');
    const ledgers = JSON.parse(localStorage.getItem('pve_ledger_accounts') || '[]');
    const ledgerNameMap = new Map<string, string>(
      (Array.isArray(ledgers) ? ledgers : []).map((ledger: any) => [String(ledger?.id ?? ''), String(ledger?.name ?? '')])
    );
    const partyDisplayName = ledgerNameMap.get(String(partyLedgerId)) || String(partyLedgerId);
    const partyVouchers = vouchers.filter((v: any) => {
      if (partyType === 'CUSTOMER') {
        return v.type === 'SALES' && 
          v.lines.some((line: any) => line.ledgerId === partyLedgerId && line.debit > 0);
      } else {
        return v.type === 'PURCHASE' && 
          v.lines.some((line: any) => line.ledgerId === partyLedgerId && line.credit > 0);
      }
    });

    const outstandingInvoices: OutstandingInvoice[] = [];
    
    for (const voucher of partyVouchers) {
      const partyLine = voucher.lines.find((line: any) => {
        if (partyType === 'CUSTOMER') {
          return line.ledgerId === partyLedgerId && line.debit > 0;
        } else {
          return line.ledgerId === partyLedgerId && line.credit > 0;
        }
      });

      if (partyLine) {
        const totalAmount = partyType === 'CUSTOMER' 
          ? partyLine.debit 
          : partyLine.credit;

        // Calculate payments against this invoice
        const paymentVouchers = vouchers.filter((v: any) => 
          v.type === (partyType === 'CUSTOMER' ? 'RECEIPT' : 'PAYMENT') &&
          v.narration?.includes(voucher.number)
        );

        const totalPaid = paymentVouchers.reduce((sum: number, payment: any) => {
          const allocMap = parseInvoiceAllocations(payment?.narration);

          // If our narration includes allocation tokens, prefer those (prevents overcounting across multiple invoices)
          if (Object.keys(allocMap).length > 0) {
            const alloc = allocMap[String(voucher.number)] ?? allocMap[voucher.number];
            return alloc ? sum + alloc : sum;
          }

          // Legacy fallback: use the party ledger amount from voucher lines
          const paymentLine = payment.lines.find((line: any) => line.ledgerId === partyLedgerId);
          return sum + (paymentLine?.credit || paymentLine?.debit || 0);
        }, 0);

        const balance = totalAmount - totalPaid;
        const dueDate = parseDueDateToken(voucher?.narration) || voucher.date;
        const dueTs = new Date(dueDate).getTime();
        const nowTs = Date.now();
        const overdueDays =
          Number.isFinite(dueTs) && nowTs > dueTs
            ? Math.floor((nowTs - dueTs) / (1000 * 60 * 60 * 24))
            : 0;

        if (balance > 0.01) { // Only show invoices with balance
          outstandingInvoices.push({
            id: voucher.id,
            type: voucher.type,
            number: voucher.number,
            date: voucher.date,
            dueDate,
            overdueDays,
            totalAmount,
            paidAmount: totalPaid,
            balanceAmount: balance,
            partyName: partyDisplayName,
            partyLedgerId,
            isSelected: false,
            paymentAmount: 0,
          });
        }
      }
    }

    return outstandingInvoices;
  } catch (error) {
    console.error('Failed to calculate outstanding invoices:', error);
    return [];
  }
}

/**
 * Calculate payment totals
 */
export function calculatePaymentTotals(invoices: OutstandingInvoice[]) {
  const selectedInvoices = invoices.filter(inv => inv.isSelected && inv.paymentAmount > 0);
  
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

  const selectedInvoices = data.selectedInvoices.filter(inv => inv.isSelected && inv.paymentAmount > 0);
  if (selectedInvoices.length === 0) {
    errors.push('Please select at least one invoice to pay');
  }

  // Check if payment amounts exceed balances
  for (const invoice of selectedInvoices) {
    if (invoice.paymentAmount > invoice.balanceAmount) {
      errors.push(`Payment amount for invoice ${invoice.number} exceeds balance amount`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Build payment voucher lines
 */
export function buildPaymentVoucherLines(data: PaymentData) {
  const lines: any[] = [];
  const { cashLedgerId } = { cashLedgerId: 'cash-ledger' }; // Would come from autoLedgerService

  if (data.paymentType === 'RECEIPT') {
    // Receipt: Customer paying us
    // Debit Cash (we receive money)
    lines.push({
      ledgerId: cashLedgerId,
      debit: data.totalAmount,
      credit: 0,
    });

    // Credit Customer (their debt reduces)
    lines.push({
      ledgerId: data.partyLedgerId,
      debit: 0,
      credit: data.totalAmount,
    });

  } else if (data.paymentType === 'ADVANCE') {
    // Advance: Customer giving advance payment
    // Debit Cash (we receive money)
    lines.push({
      ledgerId: cashLedgerId,
      debit: data.totalAmount,
      credit: 0,
    });

    // Credit Customer Advance (their advance increases)
    lines.push({
      ledgerId: data.partyLedgerId,
      debit: 0,
      credit: data.totalAmount,
    });

  } else if (data.paymentType === 'ADJUSTMENT') {
    // Adjustment: Adjusting between parties
    // Debit Party (adjusting their balance)
    lines.push({
      ledgerId: data.partyLedgerId,
      debit: data.totalAmount,
      credit: 0,
    });

    // Credit Adjustment Account (contra entry)
    lines.push({
      ledgerId: 'adjustment-ledger', // Would come from autoLedgerService
      debit: 0,
      credit: data.totalAmount,
    });

  } else {
    // Payment: We paying supplier
    // Debit Supplier (their debt reduces)
    lines.push({
      ledgerId: data.partyLedgerId,
      debit: data.totalAmount,
      credit: 0,
    });

    // Credit Cash (we pay money)
    lines.push({
      ledgerId: cashLedgerId,
      debit: 0,
      credit: data.totalAmount,
    });
  }

  return lines;
}
