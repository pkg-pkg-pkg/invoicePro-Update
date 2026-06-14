import type { VoucherType } from './vouchers';
import type { SalesDocKind } from './salesDocuments';

/** Configurable voucher / document number profiles in Settings. */
export type VoucherNumberProfileKey =
  | 'SALES'
  | 'PURCHASE'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'JOURNAL'
  | 'CONTRA'
  | 'QUOTATION'
  | 'PROFORMA'
  | 'SALES_ORDER'
  | 'DISPATCH'
  | 'CREDIT_ADJUSTMENT'
  | 'RECURRING';

export type ResetSequencePolicy = 'never' | 'yearly' | 'monthly';

export type FinancialYearLabelFormat = 'short' | 'long';

export interface VoucherTypeNumberConfig {
  prefix: string;
  separator: string;
  includeFinancialYear: boolean;
  fyFormat: FinancialYearLabelFormat;
  padDigits: number;
  startingNumber: number;
  resetSequence: ResetSequencePolicy;
}

export interface VoucherNumberingSettings {
  /** Per-type numbering rules (new vouchers only; existing numbers unchanged). */
  types: Record<VoucherNumberProfileKey, VoucherTypeNumberConfig>;
  /** One-time legacy migration from internal vch-* numbers completed. */
  migrationCompleted?: boolean;
  migrationCompletedAt?: string;
}

export const DEFAULT_VOUCHER_TYPE_CONFIG: Record<VoucherNumberProfileKey, VoucherTypeNumberConfig> = {
  SALES: { prefix: 'SALES', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  PURCHASE: { prefix: 'PUR', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  SALES_RETURN: { prefix: 'CR', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  PURCHASE_RETURN: { prefix: 'DR', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  PAYMENT: { prefix: 'PAY', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  RECEIPT: { prefix: 'REC', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  JOURNAL: { prefix: 'JV', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  CONTRA: { prefix: 'CON', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  QUOTATION: { prefix: 'QT', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  PROFORMA: { prefix: 'PI', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  SALES_ORDER: { prefix: 'SO', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  DISPATCH: { prefix: 'DN', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  CREDIT_ADJUSTMENT: { prefix: 'CA', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
  RECURRING: { prefix: 'RI', separator: '/', includeFinancialYear: true, fyFormat: 'short', padDigits: 4, startingNumber: 1, resetSequence: 'yearly' },
};

export function createDefaultVoucherNumberingSettings(): VoucherNumberingSettings {
  return { types: { ...DEFAULT_VOUCHER_TYPE_CONFIG } };
}

export const VOUCHER_NUMBER_PROFILE_LABELS: Record<VoucherNumberProfileKey, string> = {
  SALES: 'Sales Invoice / Tax Invoice',
  PURCHASE: 'Purchase Voucher',
  SALES_RETURN: 'Credit Note (Sales Return)',
  PURCHASE_RETURN: 'Debit Note (Purchase Return)',
  PAYMENT: 'Payment Voucher',
  RECEIPT: 'Receipt Voucher',
  JOURNAL: 'Journal Voucher',
  CONTRA: 'Contra Voucher',
  QUOTATION: 'Quotation',
  PROFORMA: 'Proforma Invoice',
  SALES_ORDER: 'Sales Order',
  DISPATCH: 'Dispatch Note',
  CREDIT_ADJUSTMENT: 'Credit Adjustment',
  RECURRING: 'Recurring Invoice',
};

export function voucherTypeToProfileKey(type: VoucherType): VoucherNumberProfileKey {
  return type as VoucherNumberProfileKey;
}

export function salesDocKindToProfileKey(kind: SalesDocKind): VoucherNumberProfileKey | null {
  const map: Partial<Record<SalesDocKind, VoucherNumberProfileKey>> = {
    quotations: 'QUOTATION',
    proforma: 'PROFORMA',
    'sales-orders': 'SALES_ORDER',
    dispatch: 'DISPATCH',
    'credit-adjustments': 'CREDIT_ADJUSTMENT',
    recurring: 'RECURRING',
  };
  return map[kind] ?? null;
}
