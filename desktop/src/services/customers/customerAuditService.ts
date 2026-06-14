import { generateId } from '../../utils/id';

export type CustomerAuditAction =
  | 'CUSTOMER_ACTIVATED'
  | 'CUSTOMER_DEACTIVATED'
  | 'CUSTOMER_DELETED'
  | 'STATEMENT_GENERATED'
  | 'STATEMENT_EXPORTED'
  | 'STATEMENT_SENT_WHATSAPP'
  | 'REMINDER_SENT';

export type CustomerAuditEntry = {
  id: string;
  customerId: string;
  customerName: string;
  action: CustomerAuditAction;
  userName: string;
  createdAt: string;
  meta?: Record<string, string>;
};

const STORAGE_KEY = 'pve_customer_audit_log_v1';
const MAX_ENTRIES = 500;

function readAll(): CustomerAuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: CustomerAuditEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_ENTRIES)));
}

export function logCustomerAudit(entry: Omit<CustomerAuditEntry, 'id' | 'createdAt'>): void {
  const rows = readAll();
  rows.unshift({
    ...entry,
    id: generateId('caudit'),
    createdAt: new Date().toISOString(),
  });
  writeAll(rows);
}

export function listCustomerAudit(customerId?: string, limit = 50): CustomerAuditEntry[] {
  const rows = readAll();
  const filtered = customerId ? rows.filter((r) => r.customerId === customerId) : rows;
  return filtered.slice(0, limit);
}

export function currentAuditUserName(): string {
  try {
    const raw = localStorage.getItem('pve_session_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return String(parsed?.displayName || parsed?.username || parsed?.email || 'User');
    }
  } catch {
    /* ignore */
  }
  return 'User';
}
