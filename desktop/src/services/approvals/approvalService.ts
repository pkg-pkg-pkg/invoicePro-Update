import { generateId } from '../../utils/id';
import { nowIso, readList, writeList } from '../masters/storageHelpers';
import { voucherService } from '../vouchers/voucherService';

const STORAGE_KEY = 'pve_admin_approvals';

export type ApprovalSection = 'SALES' | 'PURCHASE' | 'PAYMENT' | 'RECEIPT' | 'OTHER';
export type ApprovalAction = 'DELETE_VOUCHER' | 'UPDATE_VOUCHER' | 'OTHER';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalRequest {
  id: string;
  section: ApprovalSection;
  action: ApprovalAction;
  entityType: 'VOUCHER';
  entityId: string;
  entityLabel: string;
  reason?: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByRole: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemark?: string;
}

const normalize = (x: ApprovalRequest): ApprovalRequest => ({
  ...x,
  status: (x.status || 'PENDING') as ApprovalStatus,
});

const getActor = () => {
  try {
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : {};
    const name = String(user?.fullName || user?.username || user?.email || 'Unknown').trim();
    const role = String(user?.role || 'user').trim().toLowerCase();
    return { name, role };
  } catch {
    return { name: 'Unknown', role: 'user' };
  }
};

export const approvalService = {
  async list(): Promise<ApprovalRequest[]> {
    const rows = await readList<ApprovalRequest>(STORAGE_KEY);
    return rows.map(normalize).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  },

  async request(input: Omit<ApprovalRequest, 'id' | 'status' | 'requestedBy' | 'requestedByRole' | 'requestedAt'>): Promise<ApprovalRequest> {
    const { name, role } = getActor();
    const rows = await readList<ApprovalRequest>(STORAGE_KEY);
    const duplicate = rows.find(
      (r) =>
        r.status === 'PENDING' &&
        r.entityType === input.entityType &&
        r.entityId === input.entityId &&
        r.action === input.action
    );
    if (duplicate) {
      return normalize(duplicate);
    }
    const created: ApprovalRequest = {
      ...input,
      id: generateId('apr'),
      status: 'PENDING',
      requestedBy: name,
      requestedByRole: role,
      requestedAt: nowIso(),
    };
    rows.push(created);
    await writeList(STORAGE_KEY, rows as any);
    return created;
  },

  async approve(id: string, remark?: string): Promise<ApprovalRequest> {
    const rows = await readList<ApprovalRequest>(STORAGE_KEY);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Approval request not found');
    const req = normalize(rows[idx]);
    if (req.status !== 'PENDING') return req;
    const actor = getActor();
    if (req.entityType === 'VOUCHER' && req.action === 'DELETE_VOUCHER') {
      await voucherService.delete(req.entityId);
    }
    const updated: ApprovalRequest = {
      ...req,
      status: 'APPROVED',
      reviewedBy: actor.name,
      reviewedAt: nowIso(),
      reviewRemark: String(remark || '').trim() || undefined,
    };
    rows[idx] = updated;
    await writeList(STORAGE_KEY, rows as any);
    return updated;
  },

  async reject(id: string, remark?: string): Promise<ApprovalRequest> {
    const rows = await readList<ApprovalRequest>(STORAGE_KEY);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Approval request not found');
    const req = normalize(rows[idx]);
    const actor = getActor();
    const updated: ApprovalRequest = {
      ...req,
      status: 'REJECTED',
      reviewedBy: actor.name,
      reviewedAt: nowIso(),
      reviewRemark: String(remark || '').trim() || undefined,
    };
    rows[idx] = updated;
    await writeList(STORAGE_KEY, rows as any);
    return updated;
  },
};

