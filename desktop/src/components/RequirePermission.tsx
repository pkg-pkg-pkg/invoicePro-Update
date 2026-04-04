import { ReactNode } from 'react';
import { Alert } from '@mui/material';
import { usePermission } from '../hooks/usePermission';

interface RequirePermissionProps {
  permission:
    | 'manage-ledgers'
    | 'view-ledgers'
    | 'manage-inventory'
    | 'view-inventory'
    | 'create-vouchers'
    | 'view-vouchers'
    | 'view-reports';
  fallback?: ReactNode;
  children: ReactNode;
}

export const RequirePermission = ({ permission, fallback, children }: RequirePermissionProps) => {
  const { can } = usePermission();

  if (!can(permission)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Alert severity="warning">You do not have permission to view this page.</Alert>;
  }

  return <>{children}</>;
};

export default RequirePermission;
