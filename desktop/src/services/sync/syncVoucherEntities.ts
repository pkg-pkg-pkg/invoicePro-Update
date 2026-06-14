import type { Voucher, VoucherType } from '../../types/vouchers';

const VOUCHER_ENTITY: Record<VoucherType, string> = {
  SALES: 'sales_voucher',
  SALES_RETURN: 'sales_return',
  PURCHASE: 'purchase_voucher',
  PURCHASE_RETURN: 'purchase_return',
  PAYMENT: 'payment_voucher',
  RECEIPT: 'receipt_voucher',
  JOURNAL: 'journal_voucher',
  CONTRA: 'contra_voucher',
};

export function voucherEntityName(type: VoucherType): string {
  return VOUCHER_ENTITY[type] ?? 'sales_voucher';
}

export function voucherToPayload(voucher: Voucher): Record<string, unknown> {
  return { ...voucher } as Record<string, unknown>;
}
