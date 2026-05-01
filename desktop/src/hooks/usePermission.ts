import { useCallback } from 'react';
import { usePermissions } from './usePermissions';
import { UserPermissions } from '../store/slices/authSlice';

type UIPermission =
  | 'manage-ledgers'
  | 'view-ledgers'
  | 'manage-inventory'
  | 'view-inventory'
  | 'create-vouchers'
  | 'view-vouchers'
  | 'view-reports'
  | 'manage-users';

const mapToUserPermission: Partial<Record<UIPermission, keyof UserPermissions>> = {
  'manage-ledgers': 'manageLedgers',
  'view-ledgers': 'viewLedgers',
  'manage-inventory': 'manageInventory',
  'view-inventory': 'viewInventoryMasters',
  'create-vouchers': 'createInvoices',
  'view-vouchers': 'viewVouchers',
  'view-reports': 'viewReports',
  'manage-users': 'manageUsers',
};

export const usePermission = () => {
  const permissions = usePermissions();

  const can = useCallback(
    (permission: UIPermission) => {
      if (permission === 'create-vouchers') {
        return (
          permissions.hasPermission('createInvoices') ||
          permissions.hasPermission('createPayments')
        );
      }

      const mapped = mapToUserPermission[permission];
      return mapped ? permissions.hasPermission(mapped) : false;
    },
    [permissions]
  );

  return { can };
};
