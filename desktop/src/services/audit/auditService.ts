import { generateId } from '../../utils/id';
import { storageDriver } from '../storage/storageDriver';
import { systemLogger } from '../logging/systemLogger';
import { readStoredAuthUserRaw } from '../../utils/authStorage';

const AUDIT_KEY = 'pve_audit_log';

export type AuditOperation =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'SYNC_PUSH'
  | 'SYNC_PULL'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'SETTINGS_CHANGE'
  | 'BACKUP_RESTORE';

export interface AuditEntry {
  id: string;
  userId: string;
  username: string;
  role: string;
  companyId: string;
  timestamp: string;
  operation: AuditOperation;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const getCurrentUser = (): { id: string; username: string; role: string; companyId: string } => {
  try {
    const raw = readStoredAuthUserRaw();
    if (!raw) return { id: 'anonymous', username: 'anonymous', role: 'viewer', companyId: '' };
    const user = JSON.parse(raw);
    return {
      id: user.id ?? 'anonymous',
      username: user.username ?? user.email ?? 'anonymous',
      role: user.role ?? 'viewer',
      companyId: user.companyId ?? '',
    };
  } catch {
    return { id: 'anonymous', username: 'anonymous', role: 'viewer', companyId: '' };
  }
};

const readAuditLog = async (): Promise<AuditEntry[]> => {
  const data = await storageDriver.read<AuditEntry[]>(AUDIT_KEY, []);
  return Array.isArray(data) ? data : [];
};

const writeAuditLog = async (log: AuditEntry[]): Promise<void> => {
  await storageDriver.write(AUDIT_KEY, log);
};

export const auditService = {
  async log(
    operation: AuditOperation,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>
  ): Promise<AuditEntry> {
    const user = getCurrentUser();

    const entry: AuditEntry = {
      id: generateId('audit'),
      userId: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
      timestamp: new Date().toISOString(),
      operation,
      entityType,
      entityId,
      details,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    const log = await readAuditLog();
    log.push(entry);

    // Keep last 10000 entries to prevent unbounded growth
    const trimmed = log.slice(-10000);
    await writeAuditLog(trimmed);

    systemLogger.info('audit', {
      event: 'audit_log',
      code: 'AUDIT_ENTRY',
      message: `${operation} on ${entityType}`,
      userId: entry.userId,
      entityType,
      entityId,
      operation,
    });

    return entry;
  },

  async logCreate(entityType: string, entityId: string, details?: Record<string, unknown>): Promise<AuditEntry> {
    return this.log('CREATE', entityType, entityId, details);
  },

  async logUpdate(
    entityType: string,
    entityId: string,
    details?: Record<string, unknown> & { oldValue?: unknown; newValue?: unknown }
  ): Promise<AuditEntry> {
    return this.log('UPDATE', entityType, entityId, details);
  },

  async logSettingsChange(
    settingKey: string,
    oldValue: unknown,
    newValue: unknown
  ): Promise<AuditEntry> {
    return this.log('SETTINGS_CHANGE', 'settings', settingKey, { oldValue, newValue });
  },

  async logBackupRestore(filePath: string, details?: Record<string, unknown>): Promise<AuditEntry> {
    return this.log('BACKUP_RESTORE', 'backup', filePath, details);
  },

  async logDelete(entityType: string, entityId: string, details?: Record<string, unknown>): Promise<AuditEntry> {
    return this.log('DELETE', entityType, entityId, details);
  },

  async logView(entityType: string, entityId: string): Promise<AuditEntry> {
    return this.log('VIEW', entityType, entityId);
  },

  async logSyncPush(entityType: string, entityId: string, details?: Record<string, unknown>): Promise<AuditEntry> {
    return this.log('SYNC_PUSH', entityType, entityId, details);
  },

  async logSyncPull(entityType: string, entityId: string, details?: Record<string, unknown>): Promise<AuditEntry> {
    return this.log('SYNC_PULL', entityType, entityId, details);
  },

  async logExport(entityType: string, entityId: string, details?: Record<string, unknown>): Promise<AuditEntry> {
    return this.log('EXPORT', entityType, entityId, details);
  },

  async logLogin(): Promise<AuditEntry> {
    const user = getCurrentUser();
    return this.log('LOGIN', 'session', user.id);
  },

  async logLogout(): Promise<AuditEntry> {
    const user = getCurrentUser();
    return this.log('LOGOUT', 'session', user.id);
  },

  async getLog(filters?: {
    userId?: string;
    entityType?: string;
    operation?: AuditOperation;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<AuditEntry[]> {
    let log = await readAuditLog();

    if (filters?.userId) {
      log = log.filter((e) => e.userId === filters.userId);
    }
    if (filters?.entityType) {
      log = log.filter((e) => e.entityType === filters.entityType);
    }
    if (filters?.operation) {
      log = log.filter((e) => e.operation === filters.operation);
    }
    if (filters?.fromDate) {
      const from = new Date(filters.fromDate).getTime();
      log = log.filter((e) => new Date(e.timestamp).getTime() >= from);
    }
    if (filters?.toDate) {
      const to = new Date(filters.toDate).getTime();
      log = log.filter((e) => new Date(e.timestamp).getTime() <= to);
    }

    log.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      log = log.slice(0, filters.limit);
    }

    return log;
  },

  async getRecentActivity(limit = 50): Promise<AuditEntry[]> {
    return this.getLog({ limit });
  },

  async clearLog(): Promise<void> {
    await writeAuditLog([]);
  },
};
