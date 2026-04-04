/**
 * Expense Voucher Service
 * Handles creation of accounting vouchers when expenses are recorded
 */

import { ledgerAccountService } from '../masters/ledgerAccountService';
import { Voucher, VoucherType } from '../../types/vouchers';
import { voucherService } from '../vouchers/voucherService';

interface ExpenseVoucherInput {
  expenseId: string;
  expenseHeadLedgerId: string | null;
  amount: number;
  description: string;
  date: string;
  paymentMode: 'cash' | 'bank' | 'cheque' | 'upi' | 'card';
  bankAccountId?: string;
  referenceNumber?: string;
}

/**
 * Create a voucher for an expense transaction
 * Accounting Entry:
 *   Debit: Expense Ledger (e.g., "Transport Expense")
 *   Credit: Cash/Bank Ledger
 */
export async function createExpenseVoucher(input: ExpenseVoucherInput): Promise<string | null> {
  try {
    // If no expense ledger mapped, skip voucher creation
    if (!input.expenseHeadLedgerId) {
      console.warn('Expense head has no ledger mapping. Voucher not created.');
      return null;
    }

    // Resolve Cash/Bank ledger based on payment mode
    const cashBankLedger = await resolveCashBankLedger(input.paymentMode, input.bankAccountId);
    if (!cashBankLedger) {
      console.error('Could not resolve Cash/Bank ledger for payment mode:', input.paymentMode);
      return null;
    }

    // Create voucher
    const voucherNumber = `EXP-${Date.now()}`;
    const voucher: Omit<Voucher, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'PAYMENT' as VoucherType,
      date: new Date(input.date).toISOString(),
      number: voucherNumber,
      narration: `Expense: ${input.description}${input.referenceNumber ? ` (Ref: ${input.referenceNumber})` : ''}`,
      status: 'ACTIVE',
      lines: [
        {
          ledgerId: input.expenseHeadLedgerId,
          debit: input.amount,
          credit: 0,
        },
        {
          ledgerId: cashBankLedger.id,
          debit: 0,
          credit: input.amount,
        },
      ],
    };

    const createdVoucher = await voucherService.create(voucher);
    return createdVoucher.id;
  } catch (error) {
    console.error('Failed to create expense voucher:', error);
    throw error;
  }
}

/**
 * Resolve the appropriate Cash/Bank ledger based on payment mode
 */
async function resolveCashBankLedger(
  paymentMode: string,
  bankAccountId?: string
): Promise<{ id: string; name: string } | null> {
  const ledgers = await ledgerAccountService.list({ includeInactive: false });
  const cashBankLedgers = ledgers.filter((l) => l.isCashBank && l.isActive);

  if (cashBankLedgers.length === 0) {
    console.error('No active Cash/Bank ledgers found');
    return null;
  }

  // If bank payment and specific account provided
  if (paymentMode === 'bank' && bankAccountId) {
    const bankLedger = cashBankLedgers.find((l) => l.id === bankAccountId);
    if (bankLedger) return { id: bankLedger.id, name: bankLedger.name };
  }

  // Default to first Cash ledger for cash payments
  if (paymentMode === 'cash') {
    const cashLedger = cashBankLedgers.find(
      (l) => l.name.toLowerCase().includes('cash') || l.name.toLowerCase() === 'cash'
    );
    if (cashLedger) return { id: cashLedger.id, name: cashLedger.name };
  }

  // Fallback to first available Cash/Bank ledger
  return { id: cashBankLedgers[0].id, name: cashBankLedgers[0].name };
}

/**
 * Delete expense voucher when expense is deleted
 */
export async function deleteExpenseVoucher(voucherId: string): Promise<void> {
  try {
    await voucherService.delete(voucherId);
  } catch (error) {
    console.error('Failed to delete expense voucher:', error);
    throw error;
  }
}
