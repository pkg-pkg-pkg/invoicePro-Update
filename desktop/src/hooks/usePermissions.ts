// src/hooks/usePermissions.ts
import { useSelector } from 'react-redux';
import { UserPermissions } from '../store/slices/authSlice';
import { useAuth } from '../pages/contexts/auth';

export const usePermissions = () => {
  const reduxUser = useSelector((state: any) => state.auth?.user ?? null);
  const { user: authUser } = useAuth();

  const user = (authUser as any) ?? reduxUser ?? (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const norm = (v: any) => String(v ?? '').trim().toLowerCase();

  const email = norm((user as any)?.email) || norm(localStorage.getItem('lastLoginEmail'));
  const username = norm((user as any)?.username);
  const fullName = norm((user as any)?.fullName);

  const roleFromLocalUsers = (() => {
    try {
      const raw = localStorage.getItem('gst_billing_users');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return '';
      const hit = parsed.find((u: any) => {
        const ue = norm(u?.email);
        const uu = norm(u?.username);
        const uf = norm(u?.fullName);
        if (email && ue === email) return true;
        if (email && uu === email) return true;
        if (username && uu === username) return true;
        if (fullName && uf === fullName) return true;
        return false;
      });
      return String((hit as any)?.role ?? '').trim();
    } catch {
      return '';
    }
  })();

  const sessionRoleRaw = String((user as any)?.role ?? '').trim();
  const localRoleRaw = String(roleFromLocalUsers ?? '').trim();
  const sessionRole = sessionRoleRaw.toLowerCase();
  const localRole = localRoleRaw.toLowerCase();

  const role = ((localRole && (!sessionRole || sessionRole === 'user')) ? localRole : (sessionRole || localRole || 'user'));
  const effectiveUser = user ? { ...(user as any), role } : null;

  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!effectiveUser) {
      void permission;
      return false;
    }

    // Admin has all permissions
    if (role === 'admin') return true;

    return Boolean((effectiveUser as any)?.permissions?.[permission]);
  };

  const hasAnyPermission = (permissions: (keyof UserPermissions)[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: (keyof UserPermissions)[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  const canAccessFeature = (feature: string): boolean => {
    const permissionMap: Record<string, keyof UserPermissions> = {
      'dashboard': 'viewDashboard',
      'analytics': 'viewAnalytics',
      'create-invoice': 'createInvoices',
      'edit-invoice': 'editInvoices',
      'delete-invoice': 'deleteInvoices',
      'view-invoices': 'viewInvoices',
      'print-invoices': 'printInvoices',
      'create-payment': 'createPayments',
      'edit-payment': 'editPayments',
      'delete-payment': 'deletePayments',
      'view-payments': 'viewPayments',
      'create-customer': 'createCustomers',
      'edit-customer': 'editCustomers',
      'delete-customer': 'deleteCustomers',
      'view-customers': 'viewCustomers',
      'create-supplier': 'createSuppliers',
      'edit-supplier': 'editSuppliers',
      'delete-supplier': 'deleteSuppliers',
      'view-suppliers': 'viewSuppliers',
      'create-product': 'createProducts',
      'edit-product': 'editProducts',
      'delete-product': 'deleteProducts',
      'view-products': 'viewProducts',
      'manage-inventory': 'manageInventory',
      'view-ledgers': 'viewLedgers',
      'manage-ledgers': 'manageLedgers',
      'create-bank': 'createBankAccounts',
      'edit-bank': 'editBankAccounts',
      'delete-bank': 'deleteBankAccounts',
      'view-bank': 'viewBankAccounts',
      'view-bank-statements': 'viewBankStatements',
      'view-reports': 'viewReports',
      'export-reports': 'exportReports',
      'view-gst': 'viewGSTReports',
      'file-gst': 'fileGST',
      'manage-settings': 'manageSettings',
      'manage-users': 'manageUsers',
      'manage-company': 'manageCompany',
      'customize-print': 'customizePrint',
      'backup-data': 'backupData',
      'restore-data': 'restoreData',
    };

    const permission = permissionMap[feature];
    return permission ? hasPermission(permission) : false;
  };

  return {
    user: effectiveUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessFeature,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isAccountant: role === 'accountant',
    isSales: role === 'sales',
    isViewer: role === 'viewer',
  };
};
