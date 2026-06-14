/** Primary left-sidebar modules (modern sidebar navigation). */

export type ErpModuleNavItem = {
  id: string;
  label: string;
  icon:
    | 'Home'
    | 'Inventory2'
    | 'AccountBalance'
    | 'PointOfSale'
    | 'ShoppingCart'
    | 'People'
    | 'Assessment'
    | 'ReceiptLong'
    | 'Settings'
    | 'CardGiftcard'
    | 'Today';
  path: string;
  /** Paths that should highlight this module */
  matchPaths?: string[];
  perm?: string;
  gstOnly?: boolean;
};

export const ERP_PRIMARY_MODULES: ErpModuleNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Home', path: '/dashboard', matchPaths: ['/dashboard'] },
  {
    id: 'items',
    label: 'Items',
    icon: 'Inventory2',
    path: '/items',
    matchPaths: [
      '/items',
      '/items',
      '/masters/godowns',
      '/masters/price-lists',
      '/masters/stock-adjustments',
    ],
  },
  {
    id: 'banking',
    label: 'Banking',
    icon: 'AccountBalance',
    path: '/banking',
    matchPaths: ['/banking', '/accounts', '/masters/bank-accounts', '/vouchers/payment-vouchers', '/vouchers/receipt-vouchers', '/vouchers/money'],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: 'PointOfSale',
    path: '/sales/tax-invoices',
    matchPaths: ['/sales', '/vouchers/sales', '/vouchers/sales-return', '/vouchers/receipt-vouchers'],
  },
  { id: 'parties', label: 'Ledgers', icon: 'People', path: '/ledgers', matchPaths: ['/ledgers', '/customers', '/parties'] },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: 'ShoppingCart',
    path: '/purchase/purchase-bills',
    matchPaths: ['/purchase', '/vouchers/purchase', '/vouchers/purchase-return', '/purchase-invoices', '/expenses'],
  },
  {
    id: 'day-book',
    label: 'Day Book',
    icon: 'Today',
    path: '/day-book',
    matchPaths: ['/day-book'],
    perm: 'view-reports',
  },
  { id: 'reports', label: 'Reports', icon: 'Assessment', path: '/reports', matchPaths: ['/reports'], perm: 'view-reports' },
  { id: 'gst', label: 'GST', icon: 'ReceiptLong', path: '/gst', matchPaths: ['/gst'], gstOnly: true },
  { id: 'schemes', label: 'Schemes', icon: 'CardGiftcard', path: '/schemes', matchPaths: ['/schemes'] },
  { id: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', perm: 'manage-settings', matchPaths: ['/settings'] },
];

export type QuickAddAction = {
  id: string;
  label: string;
  hint?: string;
  path: string;
  perm?: string;
};

export const QUICK_ADD_ACTIONS: QuickAddAction[] = [
  { id: 'sales-invoice', label: 'Sales Invoice', hint: 'New bill / invoice', path: '/vouchers/sales/new', perm: 'create-vouchers' },
  { id: 'purchase', label: 'Purchase Bill', hint: 'Creditor purchase entry', path: '/vouchers/purchase/new', perm: 'create-vouchers' },
  { id: 'receipt', label: 'Receipt', hint: 'Money received', path: '/vouchers/receipt-vouchers/new', perm: 'create-vouchers' },
  { id: 'payment', label: 'Payment', hint: 'Money paid out', path: '/vouchers/payment-vouchers/new', perm: 'create-vouchers' },
  { id: 'new-item', label: 'New Item', hint: 'Inventory master', path: '/items?new=1', perm: 'manage-inventory' },
  { id: 'stock-adjust', label: 'Inventory Adjustment', hint: 'Stock increase / decrease', path: '/masters/stock-adjustments/new', perm: 'manage-inventory' },
  { id: 'price-list', label: 'Price List', hint: 'Party / category rates', path: '/masters/price-lists/new', perm: 'manage-inventory' },
  { id: 'new-party', label: 'New Debtor', hint: 'Debtor master', path: '/ledgers/debtors?new=1' },
];

export function moduleMatchesPath(module: ErpModuleNavItem, pathname: string): boolean {
  const paths = module.matchPaths ?? [module.path];
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return paths.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}
