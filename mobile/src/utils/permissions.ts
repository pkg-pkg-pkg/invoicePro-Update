type MobilePermissions = Record<string, unknown> | string[] | undefined;

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === 'true' || v === '1';
}

function hasModule(perms: MobilePermissions, module: string): boolean {
  if (!perms) return true;
  if (Array.isArray(perms)) {
    return perms.map((p) => p.toLowerCase()).includes(module.toLowerCase());
  }
  return truthy(perms[module]);
}

function anyKey(perms: MobilePermissions, keys: string[]): boolean {
  if (!perms) return true;
  if (Array.isArray(perms)) {
    const normalized = perms.map((p) => p.toLowerCase());
    return keys.some((k) => normalized.includes(k.toLowerCase()));
  }
  return keys.some((k) => truthy(perms[k]));
}

export function canCreateLedger(perms: MobilePermissions): boolean {
  return anyKey(perms, [
    'masters',
    'canCreateLedger',
    'ledgerCreate',
    'mastersCreate',
    'customerCreate',
    'supplierCreate',
  ]);
}

export function canCreateEntry(perms: MobilePermissions): boolean {
  return anyKey(perms, ['vouchers', 'canCreateEntry', 'paymentCreate', 'receiptCreate', 'voucherCreate']);
}

export function canCreateInvoice(perms: MobilePermissions): boolean {
  return anyKey(perms, [
    'sales',
    'purchase',
    'canCreateInvoice',
    'salesInvoiceCreate',
    'voucherCreate',
  ]);
}

export function hasPermissionModule(perms: MobilePermissions, module: string): boolean {
  return hasModule(perms, module);
}
