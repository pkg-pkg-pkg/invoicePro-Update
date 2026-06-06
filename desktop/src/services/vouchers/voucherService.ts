import { Voucher, VoucherLine } from '../../types/vouchers';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from '../masters/storageHelpers';
import { postVoucher, reverseVoucherPosting } from './postingEngine';
import { applyStockImpact, reverseStockImpact } from './stockImpactEngine';
import { companyScopedKey } from '../../utils/companyStorage';
import {
  assertUniqueSalesInvoiceNumber,
  commitInvoiceNumber,
} from './invoiceNumberService';

// Re-export types for other modules
export type { Voucher, VoucherLine };

const STORAGE_KEY = companyScopedKey('pve_vouchers');

function notifyVouchersChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pve:vouchers-changed'));
  }
}

export type CreateVoucherInput = Omit<Voucher, 'id' | 'createdAt' | 'status'> & {
  status?: Voucher['status'];
};

const cloneLine = (line: VoucherLine): VoucherLine => ({
  ledgerId: line.ledgerId,
  debit: Number(line.debit ?? 0),
  credit: Number(line.credit ?? 0),
  itemId: line.itemId ? sanitizeString(line.itemId) ?? undefined : undefined,
  quantity: line.quantity !== undefined ? Number(line.quantity) : undefined,
  godownId: line.godownId ? sanitizeString(line.godownId) ?? undefined : undefined,
});

const getCurrentUserRole = (): string => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'user';
    const user = JSON.parse(raw);
    return String(user?.role || 'user').trim().toLowerCase();
  } catch {
    return 'user';
  }
};

const validateVoucherPayload = (payload: CreateVoucherInput) => {
  if (!payload.type) {
    throw new Error('Voucher type is required');
  }
  if (!payload.date) {
    throw new Error('Voucher date is required');
  }
  const number = sanitizeString(payload.number ?? null);
  if (!number) {
    throw new Error('Voucher number is required');
  }
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    throw new Error('Voucher lines are required');
  }
};

const sameYearMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const buildVoucher = (payload: CreateVoucherInput): Voucher => {
  validateVoucherPayload(payload);
  return {
    id: generateId('vch'),
    type: payload.type,
    date: payload.date,
    number: sanitizeString(payload.number ?? null)!,
    narration: sanitizeString(payload.narration ?? null) ?? undefined,
    lines: payload.lines.map(cloneLine),
    status: payload.status ?? 'ACTIVE',
    createdAt: nowIso(),
  };
};

export const voucherService = {
  async list(): Promise<Voucher[]> {
    return readList<Voucher>(STORAGE_KEY);
  },

  async getById(id: string): Promise<Voucher | null> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    return vouchers.find((voucher) => voucher.id === id) ?? null;
  },

  async create(payload: CreateVoucherInput): Promise<Voucher> {
    const voucher = buildVoucher(payload);
    if (voucher.status !== 'ACTIVE') {
      throw new Error('New vouchers must be active');
    }

    if (voucher.type === 'SALES') {
      await assertUniqueSalesInvoiceNumber(voucher.number);
    }

    await postVoucher(voucher);
    await applyStockImpact(voucher);

    const vouchers = await readList<Voucher>(STORAGE_KEY);
    vouchers.push(voucher);
    await writeList(STORAGE_KEY, vouchers);

    if (voucher.type === 'SALES') {
      await commitInvoiceNumber(voucher.number);
    }

    notifyVouchersChanged();
    return voucher;
  },

  async update(id: string, payload: CreateVoucherInput): Promise<Voucher> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const index = vouchers.findIndex((voucher) => voucher.id === id);
    if (index < 0) {
      throw new Error('Voucher not found');
    }
    const existing = vouchers[index];
    if (existing.type !== 'PAYMENT' && existing.type !== 'RECEIPT' && existing.type !== 'SALES' && existing.type !== 'PURCHASE') {
      throw new Error('This voucher type cannot be edited currently');
    }
    if (payload.type !== existing.type) {
      throw new Error('Voucher type cannot be changed in edit');
    }
    if (existing.type === 'SALES') {
      await assertUniqueSalesInvoiceNumber(payload.number ?? '', id);
    }
    if (existing.type === 'SALES' || existing.type === 'PURCHASE') {
      const now = new Date();
      const existingDate = new Date(existing.date);
      const nextDate = new Date(payload.date);
      if (!sameYearMonth(existingDate, now) || !sameYearMonth(existingDate, nextDate)) {
        throw new Error('Sales/Purchase edit is allowed only in the same GST month.');
      }
    }

    const candidate = buildVoucher(payload);
    const updated: Voucher = {
      ...candidate,
      id: existing.id,
      createdAt: existing.createdAt,
      status: existing.status,
    };

    await reverseVoucherPosting(existing);
    await reverseStockImpact(existing);
    await postVoucher(updated);
    await applyStockImpact(updated);

    vouchers[index] = updated;
    await writeList(STORAGE_KEY, vouchers);
    notifyVouchersChanged();
    return updated;
  },

  async cancel(id: string): Promise<Voucher> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const index = vouchers.findIndex((v) => v.id === id);
    if (index < 0) throw new Error('Voucher not found');
    const existing = vouchers[index];
    if (existing.status === 'CANCELLED') return existing;
    await reverseVoucherPosting(existing);
    await reverseStockImpact(existing);
    const updated: Voucher = { ...existing, status: 'CANCELLED' };
    vouchers[index] = updated;
    await writeList(STORAGE_KEY, vouchers);
    notifyVouchersChanged();
    return updated;
  },

  async delete(id: string): Promise<void> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const target = vouchers.find((v) => v.id === id);
    if (target && (target.type === 'SALES' || target.type === 'PURCHASE')) {
      const role = getCurrentUserRole();
      if (role !== 'admin') {
        throw new Error('Only Admin can delete Sales/Purchase vouchers.');
      }
    }
    if (target && target.status === 'ACTIVE') {
      await reverseVoucherPosting(target);
      await reverseStockImpact(target);
    }
    const filtered = vouchers.filter(v => v.id !== id);
    await writeList(STORAGE_KEY, filtered);
    notifyVouchersChanged();
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },
};
