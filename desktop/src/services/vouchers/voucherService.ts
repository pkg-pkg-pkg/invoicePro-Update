import { Voucher, VoucherLine } from '../../types/vouchers';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from '../masters/storageHelpers';
import { postVoucher } from './postingEngine';
import { applyStockImpact } from './stockImpactEngine';

// Re-export types for other modules
export type { Voucher, VoucherLine };

const STORAGE_KEY = 'pve_vouchers';

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

    await postVoucher(voucher);
    await applyStockImpact(voucher);

    const vouchers = await readList<Voucher>(STORAGE_KEY);
    vouchers.push(voucher);
    await writeList(STORAGE_KEY, vouchers);
    return voucher;
  },

  async delete(id: string): Promise<void> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const filtered = vouchers.filter(v => v.id !== id);
    await writeList(STORAGE_KEY, filtered);
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },
};
