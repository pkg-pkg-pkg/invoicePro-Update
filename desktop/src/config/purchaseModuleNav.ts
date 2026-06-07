import type { PurchaseDocKind, PurchaseNavItem } from '../types/purchaseDocuments';

export const PURCHASE_NAV_ITEMS: PurchaseNavItem[] = [
  {
    kind: 'purchase-orders',
    label: 'Purchase Orders',
    tabLabel: 'Purchase Orders',
    description: 'Supplier orders before billing',
    icon: 'ShoppingCart',
    createLabel: 'New Purchase Order',
    createPath: '/purchase/purchase-orders/new',
    supportsPipeline: true,
  },
  {
    kind: 'purchase-bills',
    label: 'Purchase Bills',
    tabLabel: 'Purchase Bills',
    description: 'Supplier purchase invoices & GST',
    icon: 'Receipt',
    createLabel: 'New Purchase Bill',
    createPath: '/vouchers/purchase/new',
    supportsPipeline: false,
  },
  {
    kind: 'vendor-payments',
    label: 'Vendor Payments',
    tabLabel: 'Vendor Payments',
    description: 'Payments made to suppliers',
    icon: 'Payments',
    createLabel: 'Record Payment',
    createPath: '/vouchers/payment-vouchers/new',
    supportsPipeline: false,
  },
  {
    kind: 'debit-notes',
    label: 'Debit Notes',
    tabLabel: 'Debit Notes',
    description: 'Purchase returns & adjustments',
    icon: 'SwapHoriz',
    createLabel: 'New Debit Note',
    createPath: '/vouchers/purchase-return/new',
    supportsPipeline: false,
  },
  {
    kind: 'expenses',
    label: 'Expenses',
    tabLabel: 'Expenses',
    description: 'Business expenses & overheads',
    icon: 'Expense',
    createLabel: 'New Expense',
    createPath: '/expenses/new',
    supportsPipeline: false,
  },
  {
    kind: 'recurring-bills',
    label: 'Recurring Bills',
    tabLabel: 'Recurring Bills',
    description: 'Repeat supplier bills & subscriptions',
    icon: 'Autorenew',
    createLabel: 'New Recurring Bill',
    createPath: '/purchase/recurring-bills/new',
    supportsPipeline: true,
  },
];

const PURCHASE_KIND_ALIASES: Record<string, PurchaseDocKind> = {
  'purchase-order': 'purchase-orders',
  'recurring-bill': 'recurring-bills',
};

export function purchaseKindFromParam(param: string | undefined): PurchaseDocKind | null {
  if (!param) return null;
  const normalized = PURCHASE_KIND_ALIASES[param] ?? param;
  const found = PURCHASE_NAV_ITEMS.find((n) => n.kind === normalized);
  return found?.kind ?? null;
}

export function purchaseNavForKind(kind: PurchaseDocKind): PurchaseNavItem {
  return PURCHASE_NAV_ITEMS.find((n) => n.kind === kind)!;
}
