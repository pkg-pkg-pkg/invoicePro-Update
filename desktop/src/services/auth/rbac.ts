export type Role = 'admin' | 'manager' | 'accountant' | 'user' | 'viewer';

export type Permission =
  | 'masters:create'
  | 'masters:update'
  | 'masters:delete'
  | 'masters:view'
  | 'vouchers:create'
  | 'vouchers:view'
  | 'vouchers:delete'
  | 'reports:view'
  | 'reports:export'
  | 'sync:push'
  | 'sync:pull'
  | 'audit:view'
  | 'users:manage'
  | 'settings:manage';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'masters:create',
    'masters:update',
    'masters:delete',
    'masters:view',
    'vouchers:create',
    'vouchers:view',
    'vouchers:delete',
    'reports:view',
    'reports:export',
    'sync:push',
    'sync:pull',
    'audit:view',
    'users:manage',
    'settings:manage',
  ],
  manager: [
    'masters:create',
    'masters:update',
    'masters:view',
    'vouchers:create',
    'vouchers:view',
    'reports:view',
    'reports:export',
    'sync:push',
    'sync:pull',
    'audit:view',
  ],
  accountant: [
    'masters:view',
    'vouchers:create',
    'vouchers:view',
    'reports:view',
    'reports:export',
    'sync:push',
    'sync:pull',
  ],
  user: [
    'masters:view',
    'vouchers:create',
    'vouchers:view',
    'reports:view',
    'sync:push',
    'sync:pull',
  ],
  viewer: [
    'masters:view',
    'vouchers:view',
    'reports:view',
    'sync:pull',
  ],
};

const getCurrentUser = (): { id: string; role: Role; companyId: string } | null => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return {
      id: user.id ?? '',
      role: (user.role ?? 'user').toLowerCase() as Role,
      companyId: user.companyId ?? '',
    };
  } catch {
    return null;
  }
};

export const rbac = {
  getRolePermissions(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer;
  },

  hasPermission(permission: Permission, role?: Role): boolean {
    const user = getCurrentUser();
    const effectiveRole = role ?? user?.role ?? 'viewer';
    const perms = ROLE_PERMISSIONS[effectiveRole] ?? [];
    return perms.includes(permission);
  },

  canCreateMaster(): boolean {
    return this.hasPermission('masters:create');
  },

  canUpdateMaster(): boolean {
    return this.hasPermission('masters:update');
  },

  canDeleteMaster(): boolean {
    return this.hasPermission('masters:delete');
  },

  canViewMaster(): boolean {
    return this.hasPermission('masters:view');
  },

  canCreateVoucher(): boolean {
    return this.hasPermission('vouchers:create');
  },

  canViewVoucher(): boolean {
    return this.hasPermission('vouchers:view');
  },

  canDeleteVoucher(): boolean {
    return this.hasPermission('vouchers:delete');
  },

  canPushSync(): boolean {
    return this.hasPermission('sync:push');
  },

  canPullSync(): boolean {
    return this.hasPermission('sync:pull');
  },

  canViewAudit(): boolean {
    return this.hasPermission('audit:view');
  },

  canManageUsers(): boolean {
    return this.hasPermission('users:manage');
  },

  canManageSettings(): boolean {
    return this.hasPermission('settings:manage');
  },

  getCurrentUserId(): string {
    return getCurrentUser()?.id ?? '';
  },

  getCurrentRole(): Role {
    return getCurrentUser()?.role ?? 'viewer';
  },

  getCurrentCompanyId(): string {
    return getCurrentUser()?.companyId ?? '';
  },

  assertPermission(permission: Permission, action: string): void {
    if (!this.hasPermission(permission)) {
      throw new Error(`Permission denied: ${action} requires '${permission}'`);
    }
  },
};
