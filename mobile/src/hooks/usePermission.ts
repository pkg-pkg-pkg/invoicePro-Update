import { useSelector } from 'react-redux';
import { RootState } from '../store';

const PARENT_ROLES = new Set(['ADMIN', 'admin', 'PARENT', 'parent', 'OWNER', 'owner']);

function normalizePermissions(user: RootState['auth']['user']): string[] {
  if (!user) return [];
  if (user.permissions?.length) {
    return user.permissions.map((p) => p.toLowerCase());
  }
  if (user.mobilePermissions && typeof user.mobilePermissions === 'object') {
    return Object.entries(user.mobilePermissions)
      .filter(([, value]) => value === true || value === 1 || value === 'true' || value === '1')
      .map(([key]) => key.toLowerCase());
  }
  return [];
}

export function usePermission(module: string): boolean {
  const user = useSelector((state: RootState) => state.auth.user);
  if (!user) return false;

  const role = String(user.role || '');
  if (PARENT_ROLES.has(role)) return true;

  const permissions = normalizePermissions(user);
  if (permissions.length === 0) return true;

  return permissions.includes(module.toLowerCase());
}

export function usePermissions(): string[] {
  const user = useSelector((state: RootState) => state.auth.user);
  if (!user) return [];
  if (PARENT_ROLES.has(String(user.role || ''))) {
    return ['sales', 'purchase', 'reports', 'masters', 'vouchers'];
  }
  return normalizePermissions(user);
}
