import type { Voucher } from '../../types/vouchers';
import {
  assertUniqueVoucherNumber,
  commitVoucherNumber,
  peekNextVoucherNumber,
} from './voucherNumberService';

/** @deprecated Use voucherNumberService — kept for sales invoice form compatibility. */
export async function peekNextInvoiceNumber(): Promise<string> {
  return peekNextVoucherNumber('SALES');
}

export async function assertUniqueSalesInvoiceNumber(
  number: string,
  excludeVoucherId?: string
): Promise<void> {
  await assertUniqueVoucherNumber('SALES', number, excludeVoucherId);
}

export async function commitInvoiceNumber(number: string): Promise<void> {
  await commitVoucherNumber('SALES', number);
}
