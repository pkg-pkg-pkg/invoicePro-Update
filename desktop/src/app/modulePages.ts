/**
 * Primary sidebar module entry pages — eager (no lazy chunk) so tab clicks are instant.
 * Deep routes (forms, edit screens) stay lazy in lazyPages.ts.
 */
export { default as ItemsWorkspace } from '../pages/items/ItemsWorkspace';
export { default as BankingHub } from '../pages/hubs/BankingHub';
export { default as SalesDocumentPage } from '../pages/sales/SalesDocumentPage';
export { default as PurchaseDocumentPage } from '../pages/purchase/PurchaseDocumentPage';
export { default as CustomersListPage } from '../pages/customers/CustomersListPage';
export { default as Reports } from '../pages/Reports';
export { default as DayBookPage } from '../pages/DayBookPage';
export { default as GSTReports } from '../pages/GST/GSTReports';
export { default as Schemes } from '../pages/Schemes';
export { default as Settings } from '../pages/Settings';
