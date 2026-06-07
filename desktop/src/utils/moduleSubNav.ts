import type { SalesDocKind } from '../types/salesDocuments';
import type { PurchaseDocKind } from '../types/purchaseDocuments';

export function salesSubNavActive(kind: SalesDocKind, pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const base = `/sales/${kind}`;
  if (normalized === base || normalized.startsWith(`${base}/`)) return true;
  if (kind === 'tax-invoices' && (normalized.startsWith('/vouchers/sales') || normalized.startsWith('/sales/invoices'))) return true;
  if (kind === 'collections' && (normalized.startsWith('/vouchers/receipt-vouchers') || normalized.startsWith('/sales/collections'))) return true;
  if (kind === 'credit-adjustments' && normalized.startsWith('/vouchers/sales-return')) return true;
  return false;
}

export function purchaseSubNavActive(kind: PurchaseDocKind, pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const base = `/purchase/${kind}`;
  if (normalized === base || normalized.startsWith(`${base}/`)) return true;
  if (kind === 'purchase-bills' && normalized.startsWith('/vouchers/purchase')) return true;
  if (kind === 'vendor-payments' && normalized.startsWith('/vouchers/payment-vouchers')) return true;
  if (kind === 'debit-notes' && normalized.startsWith('/vouchers/purchase-return')) return true;
  if (kind === 'expenses' && normalized.startsWith('/expenses')) return true;
  return false;
}

export function salesModuleExpanded(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (
    normalized.startsWith('/sales') ||
    normalized.startsWith('/sales/invoices') ||
    normalized.startsWith('/sales/collections') ||
    normalized.startsWith('/vouchers/sales') ||
    normalized.startsWith('/vouchers/sales-return') ||
    normalized.startsWith('/vouchers/receipt-vouchers')
  );
}

export function purchaseModuleExpanded(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (
    normalized.startsWith('/purchase') ||
    normalized.startsWith('/vouchers/purchase') ||
    normalized.startsWith('/vouchers/purchase-return') ||
    normalized.startsWith('/expenses')
  );
}

export function itemsSubNavActive(itemId: string, pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (itemId === 'list') return normalized === '/items';
  if (itemId === 'price-lists') {
    return normalized.startsWith('/items/price-lists') || normalized.startsWith('/masters/price-lists');
  }
  if (itemId === 'adjustments') {
    return normalized.startsWith('/items/adjustments') || normalized.startsWith('/masters/stock-adjustments');
  }
  if (itemId === 'godowns') return normalized.startsWith('/masters/godowns');
  return false;
}

export function itemsModuleExpanded(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (
    normalized === '/items' ||
    normalized.startsWith('/items/') ||
    normalized.startsWith('/masters/inventory-items') ||
    normalized.startsWith('/masters/godowns') ||
    normalized.startsWith('/masters/price-lists') ||
    normalized.startsWith('/masters/stock-adjustments')
  );
}
