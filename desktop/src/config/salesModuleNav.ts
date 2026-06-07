import type { SalesDocKind } from '../types/salesDocuments';

export type SalesNavItem = {
  kind: SalesDocKind;
  label: string;
  /** Horizontal tab label */
  tabLabel: string;
  shortLabel: string;
  description: string;
  /** MUI icon name key */
  icon:
    | 'RequestQuote'
    | 'Description'
    | 'ShoppingBag'
    | 'LocalShipping'
    | 'Receipt'
    | 'Payments'
    | 'SwapHoriz'
    | 'Autorenew';
  createLabel: string;
  createPath?: string;
  supportsPipeline: boolean;
};

export const SALES_NAV_ITEMS: SalesNavItem[] = [
  {
    kind: 'quotations',
    label: 'Quotations',
    tabLabel: 'Quotations',
    shortLabel: 'Quotes',
    description: 'Price offers before confirmation',
    icon: 'RequestQuote',
    createLabel: 'New Quotation',
    createPath: '/sales/quotations/new',
    supportsPipeline: true,
  },
  {
    kind: 'proforma',
    label: 'Proforma Invoices',
    tabLabel: 'Proforma',
    shortLabel: 'Proforma',
    description: 'Pre-billing documents for approval',
    icon: 'Description',
    createLabel: 'New Proforma',
    createPath: '/sales/proforma/new',
    supportsPipeline: true,
  },
  {
    kind: 'sales-orders',
    label: 'Sales Orders',
    tabLabel: 'Sales Orders',
    shortLabel: 'Orders',
    description: 'Confirmed customer orders',
    icon: 'ShoppingBag',
    createLabel: 'New Sales Order',
    createPath: '/sales/sales-orders/new',
    supportsPipeline: true,
  },
  {
    kind: 'dispatch',
    label: 'Dispatch Notes',
    tabLabel: 'Dispatch Notes',
    shortLabel: 'Dispatch',
    description: 'Delivery and shipment records',
    icon: 'LocalShipping',
    createLabel: 'New Dispatch Note',
    createPath: '/sales/dispatch/new',
    supportsPipeline: true,
  },
  {
    kind: 'tax-invoices',
    label: 'Tax Invoices',
    tabLabel: 'Tax Invoices',
    shortLabel: 'Invoices',
    description: 'GST sales invoices & billing',
    icon: 'Receipt',
    createLabel: 'New Tax Invoice',
    createPath: '/vouchers/sales/new',
    supportsPipeline: false,
  },
  {
    kind: 'collections',
    label: 'Collections',
    tabLabel: 'Collections',
    shortLabel: 'Collections',
    description: 'Receipts against sales',
    icon: 'Payments',
    createLabel: 'Record Collection',
    createPath: '/sales/collections/new',
    supportsPipeline: false,
  },
  {
    kind: 'credit-adjustments',
    label: 'Credit Adjustments',
    tabLabel: 'Credit Adjustments',
    shortLabel: 'Credits',
    description: 'Returns, credit notes & adjustments',
    icon: 'SwapHoriz',
    createLabel: 'New Credit Note',
    createPath: '/vouchers/sales-return/new',
    supportsPipeline: false,
  },
  {
    kind: 'recurring',
    label: 'Recurring Billing',
    tabLabel: 'Recurring',
    shortLabel: 'Recurring',
    description: 'Subscription & repeat invoices',
    icon: 'Autorenew',
    createLabel: 'New Recurring Plan',
    createPath: '/sales/recurring/new',
    supportsPipeline: true,
  },
];

export function salesKindFromParam(param: string | undefined): SalesDocKind | null {
  const found = SALES_NAV_ITEMS.find((n) => n.kind === param);
  return found?.kind ?? null;
}

export function salesNavForKind(kind: SalesDocKind): SalesNavItem {
  return SALES_NAV_ITEMS.find((n) => n.kind === kind)!;
}
