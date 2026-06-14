import type { UserPermissions, UserRole } from '../store/slices/authSlice';
import { DEFAULT_PERMISSIONS } from '../store/slices/authSlice';

/** Production role identifiers shown in User Management. */
export type ProductionRoleId =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'billing_operator'
  | 'accountant'
  | 'viewer';

export const PRODUCTION_ROLES: Array<{
  id: ProductionRoleId;
  label: string;
  description: string;
  /** Maps to persisted UserRole in authSlice */
  storageRole: UserRole;
}> = [
  { id: 'super_admin', label: 'Super Admin', description: 'Full system access including user management', storageRole: 'admin' },
  { id: 'admin', label: 'Admin', description: 'Company administrator', storageRole: 'admin' },
  { id: 'manager', label: 'Manager', description: 'Operations manager — no delete/restore', storageRole: 'manager' },
  { id: 'billing_operator', label: 'Billing Operator', description: 'Sales billing and debtor entry', storageRole: 'sales' },
  { id: 'accountant', label: 'Accountant', description: 'Financial reports and vouchers', storageRole: 'accountant' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only access', storageRole: 'viewer' },
];

/** High-level production permissions mapped to UserPermissions keys. */
export const PRODUCTION_PERMISSION_MATRIX: Array<{
  id: string;
  label: string;
  keys: Array<keyof UserPermissions>;
}> = [
  { id: 'customer_create', label: 'Debtor Create', keys: ['createCustomers'] },
  { id: 'customer_delete', label: 'Debtor Delete', keys: ['deleteCustomers'] },
  { id: 'voucher_create', label: 'Voucher Create', keys: ['createInvoices', 'createPayments'] },
  { id: 'voucher_delete', label: 'Voucher Delete', keys: ['deleteInvoices', 'deletePayments'] },
  { id: 'gst_reports', label: 'GST Reports', keys: ['viewGSTReports'] },
  { id: 'inventory_edit', label: 'Inventory Edit', keys: ['manageInventory', 'editProducts'] },
  { id: 'backup_restore', label: 'Backup Restore', keys: ['restoreData'] },
  { id: 'company_settings', label: 'Company Settings', keys: ['manageCompany', 'manageSettings'] },
  { id: 'user_management', label: 'User Management', keys: ['manageUsers'] },
];

export function productionRoleHasPermission(
  roleId: ProductionRoleId,
  permissionId: string
): boolean {
  const roleDef = PRODUCTION_ROLES.find((r) => r.id === roleId);
  if (!roleDef) return false;
  const perms = DEFAULT_PERMISSIONS[roleDef.storageRole];
  const row = PRODUCTION_PERMISSION_MATRIX.find((p) => p.id === permissionId);
  if (!row) return false;
  return row.keys.every((k) => Boolean(perms[k]));
}

export function resolveProductionRoleId(storageRole: string): ProductionRoleId {
  const r = String(storageRole || '').toLowerCase();
  if (r === 'super_admin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'sales' || r === 'billing_operator') return 'billing_operator';
  if (r === 'accountant') return 'accountant';
  return 'viewer';
}
