import { Voucher, VoucherLine } from '../../types/vouchers';
import type { PartySettlementInput } from '../../types/billReference';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from '../masters/storageHelpers';
import { auditService } from '../audit/auditService';
import { postVoucher, reverseVoucherPosting } from './postingEngine';
import { applyStockImpact, reverseStockImpact } from './stockImpactEngine';
import { companyScopedKey } from '../../utils/companyStorage';
import {
  assertUniqueSalesInvoiceNumber,
  commitInvoiceNumber,
} from './invoiceNumberService';
import {
  assertUniqueVoucherNumber,
  commitVoucherNumber,
  resolveVoucherNumberForSave,
} from './voucherNumberService';
import { voucherTypeToProfileKey } from '../../types/voucherNumbering';
import { fireAndForgetDelta } from '../sync/syncDeltaHelper';
import { voucherEntityName, voucherToPayload } from '../sync/syncVoucherEntities';
import { billReferenceService } from '../settlement/billReferenceService';
import { trackFeatureUsage } from '../privacy/featureAnalyticsService';

// Re-export types for other modules
export type { Voucher, VoucherLine };

const STORAGE_KEY = companyScopedKey('pve_vouchers');

export type VoucherWriteOptions = {
  /** Required for PAYMENT/RECEIPT when changing settlement; auto-captured on edit if omitted. */
  settlements?: PartySettlementInput[];
};

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

const getCurrentUser = (): { role: string; username: string } => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return { role: 'user', username: '—' };
    const user = JSON.parse(raw);
    return {
      role: String(user?.role || 'user').trim().toLowerCase(),
      username: String(user?.username || user?.email || user?.fullName || '—').trim(),
    };
  } catch {
    return { role: 'user', username: '—' };
  }
};

const getCurrentUserRole = (): string => getCurrentUser().role;

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

const emitVoucherDelta = (voucher: Voucher, operation: 'upsert' | 'delete'): void => {
  fireAndForgetDelta({
    entity: voucherEntityName(voucher.type),
    operation,
    payload: voucherToPayload(voucher),
  });
};

const buildVoucher = async (payload: CreateVoucherInput): Promise<Voucher> => {
  validateVoucherPayload(payload);
  const number = await resolveVoucherNumberForSave(payload.type, payload.date, payload.number);
  return {
    id: generateId('vch'),
    type: payload.type,
    date: payload.date,
    number,
    narration: sanitizeString(payload.narration ?? null) ?? undefined,
    lines: payload.lines.map(cloneLine),
    status: payload.status ?? 'ACTIVE',
    createdAt: nowIso(),
    createdBy: getCurrentUser().username,
    ewayBill: payload.ewayBill,
  };
};

async function removeVoucherRecord(voucherId: string): Promise<void> {
  const vouchers = await readList<Voucher>(STORAGE_KEY);
  await writeList(
    STORAGE_KEY,
    vouchers.filter((v) => v.id !== voucherId)
  );
}

async function safeReverseEffects(voucher: Voucher): Promise<void> {
  try {
    await reverseVoucherPosting(voucher);
  } catch {
    /* best-effort rollback */
  }
  try {
    await reverseStockImpact(voucher);
  } catch {
    /* best-effort rollback */
  }
  try {
    await billReferenceService.reverseSettlementVoucher(voucher.id);
  } catch {
    /* best-effort rollback */
  }
}

async function applySideEffects(
  voucher: Voucher,
  options?: VoucherWriteOptions
): Promise<void> {
  await postVoucher(voucher);
  await applyStockImpact(voucher);

  if (voucher.type === 'SALES') {
    await commitInvoiceNumber(voucher.number);
  } else {
    await commitVoucherNumber(voucherTypeToProfileKey(voucher.type), voucher.number, voucher.date);
  }

  if (voucher.type === 'SALES' || voucher.type === 'PURCHASE') {
    await billReferenceService.syncInvoiceReference(voucher);
  }

  if (voucher.type === 'PAYMENT' || voucher.type === 'RECEIPT') {
    const settlements = options?.settlements ?? [];
    if (settlements.length > 0) {
      await billReferenceService.applySettlementVoucher(voucher, settlements, {
        replaceExisting: true,
      });
    }
    await billReferenceService.assertSettlementIntegrity(`voucher ${voucher.number}`);
  }
}

export const voucherService = {
  async list(options?: { includeDeleted?: boolean }): Promise<Voucher[]> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    if (options?.includeDeleted) return vouchers;
    return vouchers.filter((voucher) => !voucher.isDeleted);
  },

  async getById(id: string): Promise<Voucher | null> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    return vouchers.find((voucher) => voucher.id === id) ?? null;
  },

  async create(payload: CreateVoucherInput, options?: VoucherWriteOptions): Promise<Voucher> {
    const voucher = await buildVoucher(payload);
    if (voucher.status !== 'ACTIVE') {
      throw new Error('New vouchers must be active');
    }

    if (voucher.type === 'SALES') {
      await assertUniqueSalesInvoiceNumber(voucher.number);
    } else {
      await assertUniqueVoucherNumber(voucher.type, voucher.number);
    }

    const vouchers = await readList<Voucher>(STORAGE_KEY);
    vouchers.push(voucher);
    await writeList(STORAGE_KEY, vouchers);

    try {
      await applySideEffects(voucher, options);
    } catch (err) {
      await safeReverseEffects(voucher);
      await removeVoucherRecord(voucher.id);
      throw err;
    }

    if (voucher.type === 'SALES') trackFeatureUsage('invoiceCreated');
    if (voucher.type === 'PURCHASE') trackFeatureUsage('purchaseCreated');

    notifyVouchersChanged();
    emitVoucherDelta(voucher, 'upsert');
    return voucher;
  },

  async update(
    id: string,
    payload: CreateVoucherInput,
    options?: VoucherWriteOptions
  ): Promise<Voucher> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const index = vouchers.findIndex((voucher) => voucher.id === id);
    if (index < 0) {
      throw new Error('Voucher not found');
    }
    const existing = vouchers[index];
    if (
      existing.type !== 'PAYMENT' &&
      existing.type !== 'RECEIPT' &&
      existing.type !== 'SALES' &&
      existing.type !== 'PURCHASE'
    ) {
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

    const capturedSettlements =
      existing.type === 'PAYMENT' || existing.type === 'RECEIPT'
        ? options?.settlements ?? (await billReferenceService.exportSettlementsForVoucher(existing))
        : undefined;

    const rollbackSnapshot: Voucher = {
      ...existing,
      lines: existing.lines.map(cloneLine),
    };

    const candidate = await buildVoucher(payload);
    const updated: Voucher = {
      ...candidate,
      id: existing.id,
      createdAt: existing.createdAt,
      createdBy: existing.createdBy ?? candidate.createdBy,
      status: existing.status,
      isDeleted: existing.isDeleted,
      deletedAt: existing.deletedAt,
      deletedBy: existing.deletedBy,
    };

    await reverseVoucherPosting(existing);
    await reverseStockImpact(existing);
    if (existing.type === 'PAYMENT' || existing.type === 'RECEIPT') {
      await billReferenceService.reverseSettlementVoucher(existing.id);
    }

    vouchers[index] = updated;
    await writeList(STORAGE_KEY, vouchers);

    try {
      await postVoucher(updated);
      await applyStockImpact(updated);

      if (updated.type === 'SALES' || updated.type === 'PURCHASE') {
        await billReferenceService.syncInvoiceReference(updated);
      }

      if (updated.type === 'PAYMENT' || updated.type === 'RECEIPT') {
        if (!capturedSettlements || capturedSettlements.length === 0) {
          throw new Error('Settlement data could not be preserved for this payment/receipt edit.');
        }
        await billReferenceService.applySettlementVoucher(updated, capturedSettlements, {
          replaceExisting: true,
        });
        await billReferenceService.assertSettlementIntegrity(`edit ${updated.number}`);
        await billReferenceService.runSettlementAuditAfterChange('payment-receipt-edit');
      }
    } catch (err) {
      await safeReverseEffects(updated);
      vouchers[index] = rollbackSnapshot;
      await writeList(STORAGE_KEY, vouchers);
      try {
        if (rollbackSnapshot.status === 'ACTIVE') {
          await postVoucher(rollbackSnapshot);
          await applyStockImpact(rollbackSnapshot);
          if (rollbackSnapshot.type === 'SALES' || rollbackSnapshot.type === 'PURCHASE') {
            await billReferenceService.syncInvoiceReference(rollbackSnapshot);
          }
          if (rollbackSnapshot.type === 'PAYMENT' || rollbackSnapshot.type === 'RECEIPT') {
            if (capturedSettlements && capturedSettlements.length > 0) {
              await billReferenceService.applySettlementVoucher(rollbackSnapshot, capturedSettlements, {
                replaceExisting: true,
              });
            }
          }
        }
      } catch {
        /* rollback best-effort */
      }
      throw err;
    }

    await auditService.logUpdate('VOUCHER', id, {
      action: 'VOUCHER_EDITED',
      voucherNumber: updated.number,
      voucherType: updated.type,
      oldData: existing,
      newData: updated,
    });
    notifyVouchersChanged();
    emitVoucherDelta(updated, 'upsert');
    return updated;
  },

  async cancel(id: string): Promise<Voucher> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const index = vouchers.findIndex((v) => v.id === id);
    if (index < 0) throw new Error('Voucher not found');
    const existing = vouchers[index];
    if (existing.status === 'CANCELLED') return existing;

    const updated: Voucher = { ...existing, status: 'CANCELLED' };
    vouchers[index] = updated;
    await writeList(STORAGE_KEY, vouchers);

    try {
      await reverseVoucherPosting(existing);
      await reverseStockImpact(existing);
      await billReferenceService.onVoucherCancelled(existing);
    } catch (err) {
      vouchers[index] = existing;
      await writeList(STORAGE_KEY, vouchers);
      throw err;
    }

    notifyVouchersChanged();
    emitVoucherDelta(updated, 'upsert');
    return updated;
  },

  async delete(id: string): Promise<void> {
    return this.softDelete(id);
  },

  async softDelete(id: string): Promise<void> {
    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const index = vouchers.findIndex((v) => v.id === id);
    if (index < 0) throw new Error('Voucher not found');
    const target = vouchers[index];
    if (target.isDeleted) return;

    if (target.type === 'SALES' || target.type === 'PURCHASE') {
      const role = getCurrentUserRole();
      if (role !== 'admin') {
        throw new Error('Only Admin can delete Sales/Purchase vouchers.');
      }
    }

    const user = getCurrentUser();
    const updated: Voucher = {
      ...target,
      isDeleted: true,
      deletedAt: nowIso(),
      deletedBy: user.username,
    };
    vouchers[index] = updated;
    await writeList(STORAGE_KEY, vouchers);

    try {
      if (target.status === 'ACTIVE') {
        await reverseVoucherPosting(target);
        await reverseStockImpact(target);
        await billReferenceService.onVoucherCancelled(target);
      }
    } catch (err) {
      vouchers[index] = target;
      await writeList(STORAGE_KEY, vouchers);
      throw err;
    }

    await auditService.logDelete('VOUCHER', id, {
      action: 'VOUCHER_DELETED',
      voucherNumber: target.number,
      voucherType: target.type,
      oldData: target,
      newData: updated,
    });
    notifyVouchersChanged();
    emitVoucherDelta(updated, 'delete');
  },

  async restore(id: string): Promise<Voucher> {
    const role = getCurrentUserRole();
    if (role !== 'admin') {
      throw new Error('Only Admin can restore deleted vouchers.');
    }

    const vouchers = await readList<Voucher>(STORAGE_KEY);
    const index = vouchers.findIndex((v) => v.id === id);
    if (index < 0) throw new Error('Voucher not found');
    const existing = vouchers[index];
    if (!existing.isDeleted) return existing;

    const restored: Voucher = {
      ...existing,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
    };

    vouchers[index] = restored;
    await writeList(STORAGE_KEY, vouchers);

    try {
      if (restored.status === 'ACTIVE') {
        await postVoucher(restored);
        await applyStockImpact(restored);

        if (restored.type === 'SALES' || restored.type === 'PURCHASE') {
          await billReferenceService.syncInvoiceReference(restored);
        }
        if (restored.type === 'PAYMENT' || restored.type === 'RECEIPT') {
          await billReferenceService.restoreSettlementForVoucher(restored);
          await billReferenceService.assertSettlementIntegrity(`restore ${restored.number}`);
        }
      }
      await billReferenceService.runSettlementAuditAfterChange('voucher-restore');
    } catch (err) {
      vouchers[index] = existing;
      await writeList(STORAGE_KEY, vouchers);
      await safeReverseEffects(restored);
      throw err;
    }

    await auditService.logUpdate('VOUCHER', id, {
      action: 'VOUCHER_RESTORED',
      voucherNumber: restored.number,
      voucherType: restored.type,
      oldData: existing,
      newData: restored,
    });
    notifyVouchersChanged();
    emitVoucherDelta(restored, 'upsert');
    return restored;
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },
};
