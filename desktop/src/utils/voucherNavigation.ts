import type { Voucher, VoucherType } from '../types/vouchers';
import type { SalesDocKind } from '../types/salesDocuments';

const SALES_DOC_KIND_PATH: Partial<Record<SalesDocKind, string>> = {
  quotations: 'quotations',
  proforma: 'proforma',
  'sales-orders': 'sales-orders',
  dispatch: 'dispatch',
  'tax-invoices': 'tax-invoices',
  collections: 'collections',
  'credit-adjustments': 'credit-adjustments',
  recurring: 'recurring',
};

/** Resolve edit/view route for an accounting voucher (uses internal id, never shown). */
export function getVoucherEditPath(voucher: Pick<Voucher, 'id' | 'type'>): string | null {
  switch (voucher.type) {
    case 'SALES':
      return `/vouchers/sales/${encodeURIComponent(voucher.id)}/edit`;
    case 'PURCHASE':
      return `/vouchers/purchase/${encodeURIComponent(voucher.id)}/edit`;
    case 'RECEIPT':
      return `/vouchers/receipt-vouchers/${encodeURIComponent(voucher.id)}/edit`;
    case 'PAYMENT':
      return `/vouchers/payment-vouchers/${encodeURIComponent(voucher.id)}/edit`;
    case 'SALES_RETURN':
      return '/vouchers/sales-return';
    case 'PURCHASE_RETURN':
      return '/vouchers/purchase-return';
    case 'JOURNAL':
      return '/vouchers/journal';
    case 'CONTRA':
      return '/vouchers/money/new?type=CONTRA';
    default:
      return null;
  }
}

export function getVoucherEditPathById(
  voucherId: string,
  voucherType: string | VoucherType
): string | null {
  return getVoucherEditPath({ id: voucherId, type: voucherType as VoucherType });
}

export function getSalesPipelineEditPath(kind: SalesDocKind, documentId: string): string | null {
  const segment = SALES_DOC_KIND_PATH[kind];
  if (!segment) return null;
  return `/sales/${segment}/${encodeURIComponent(documentId)}/edit`;
}

export function resolveVoucherNumberLabel(
  voucherNumber: string | undefined | null,
  voucherId: string | undefined | null
): string {
  const label = String(voucherNumber ?? '').trim();
  if (label && !/^vch-[a-z0-9-]+$/i.test(label)) return label;
  return voucherId ? '—' : '—';
}
