type MobilePermissions = Record<string, unknown> | undefined;

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === 'true' || v === '1';
}

function anyKey(perms: MobilePermissions, keys: string[]): boolean {
  if (!perms) return true;
  return keys.some((k) => truthy(perms[k]));
}

export function canCreateLedger(perms: MobilePermissions): boolean {
  return anyKey(perms, [
    'canCreateLedger',
    'ledgerCreate',
    'mastersCreate',
    'customerCreate',
    'supplierCreate',
  ]);
}

export function canCreateEntry(perms: MobilePermissions): boolean {
  return anyKey(perms, ['canCreateEntry', 'paymentCreate', 'receiptCreate', 'voucherCreate']);
}

export function canCreateInvoice(perms: MobilePermissions): boolean {
  return anyKey(perms, ['canCreateInvoice', 'salesInvoiceCreate', 'voucherCreate']);
}

