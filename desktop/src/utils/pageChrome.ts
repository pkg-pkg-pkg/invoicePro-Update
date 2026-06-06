/**
 * Layout chrome helpers — keep toolbar title / heading behaviour consistent app-wide.
 */
export function pageHasOwnHeading(pathname: string): boolean {
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';

  if (path === '/masters/inventory-items' || path === '/products' || path === '/items') return true;
  if (path.startsWith('/items/')) return true;
  if (path === '/customers' || path.startsWith('/customers/')) return true;
  if (path === '/purchase' || path.startsWith('/purchase/')) return true;
  if (path.startsWith('/sales/') || path === '/sales') return true;

  if (path.startsWith('/vouchers/sales') || path.startsWith('/vouchers/purchase')) return true;
  if (path.startsWith('/vouchers/sales-return') || path.startsWith('/vouchers/purchase-return')) return true;

  return false;
}
