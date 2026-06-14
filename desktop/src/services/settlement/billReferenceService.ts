import type { Voucher } from '../../types/vouchers';
import type {
  BillReference,
  BillReferenceAdjustment,
  BillReferenceStatus,
  BillReferenceType,
  PartySettlementInput,
  SettlementMode,
} from '../../types/billReference';
import { generateId } from '../../utils/id';
import { getActiveCompanyId, companyScopedKey } from '../../utils/companyStorage';
import { nowIso, readList, writeList } from '../masters/storageHelpers';
import { auditService } from '../audit/auditService';
import { voucherService } from '../vouchers/voucherService';
import { ledgerAccountService } from '../masters/ledgerAccountService';

const REFERENCES_KEY = companyScopedKey('pve_bill_references');
const ADJUSTMENTS_KEY = companyScopedKey('pve_bill_reference_adjustments');
const MIGRATION_FLAG_KEY = companyScopedKey('pve_bill_ref_migration_v1');

const TOLERANCE = 0.02;

export type BillReferenceMigrationPreview = {
  invoiceRefs: number;
  settlementAdjustments: number;
  advanceOnAccountRefs: number;
  openingBalanceRefs: number;
  totalReferences: number;
  messages: string[];
};

export type BillReferenceSettlementAuditRow = {
  referenceId: string;
  referenceNo: string;
  partyId: string;
  referenceType: BillReferenceType;
  valid: boolean;
  issues: string[];
};

export type BillReferenceSettlementAudit = {
  valid: boolean;
  totalReferences: number;
  invalidReferences: number;
  orphanReferences: number;
  rows: BillReferenceSettlementAuditRow[];
  checks: Array<{ id: string; label: string; valid: boolean; detail: string }>;
};

const CUSTOMER_GROUPS = new Set(['grp-sundry-debtors']);
const SUPPLIER_GROUPS = new Set(['grp-sundry-creditors']);

const roundMoney = (value: number) => Number(Number(value || 0).toFixed(2));

const computeStatus = (pending: number, adjusted: number): BillReferenceStatus => {
  if (pending <= 0.01) return 'SETTLED';
  if (adjusted > 0.01) return 'PARTIALLY_SETTLED';
  return 'OPEN';
};

const parseInvoiceAllocations = (narration?: string): Record<string, number> => {
  const map: Record<string, number> = {};
  if (!narration) return map;
  const re = /INVALLOC\[(.+?)\]=(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(narration))) {
    const invoiceNumber = match[1];
    const amount = Number(match[2]);
    if (!invoiceNumber || Number.isNaN(amount)) continue;
    map[invoiceNumber] = roundMoney((map[invoiceNumber] ?? 0) + amount);
  }
  return map;
};

const parseSettlementMode = (narration?: string): SettlementMode | null => {
  if (!narration) return null;
  const m = String(narration).match(/SETTLEMODE=(AGAINST_REF|ADVANCE|ON_ACCOUNT)/i);
  if (!m) return null;
  return m[1].toUpperCase() as SettlementMode;
};

async function logReferenceAudit(
  action: 'REFERENCE_CREATED' | 'REFERENCE_ADJUSTED' | 'REFERENCE_SETTLED',
  ref: BillReference,
  extra?: Record<string, unknown>
): Promise<void> {
  await auditService.log('UPDATE', 'BILL_REFERENCE', ref.id, {
    action,
    referenceNo: ref.referenceNo,
    referenceType: ref.referenceType,
    partyId: ref.partyId,
    pendingAmount: ref.pendingAmount,
    ...extra,
  });
}

async function buildGroupMap(): Promise<Map<string, string>> {
  const ledgers = await ledgerAccountService.list({ includeInactive: true });
  return new Map(ledgers.map((l) => [l.id, l.groupId]));
}

async function resolvePartyFromVoucher(
  voucher: Voucher,
  expected: 'CUSTOMER' | 'SUPPLIER'
): Promise<{ partyId: string; amount: number } | null> {
  const groupMap = await buildGroupMap();
  const groups = expected === 'CUSTOMER' ? CUSTOMER_GROUPS : SUPPLIER_GROUPS;
  for (const line of voucher.lines ?? []) {
    const gid = groupMap.get(line.ledgerId) ?? '';
    if (!groups.has(gid)) continue;
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (expected === 'CUSTOMER' && debit > 0) return { partyId: line.ledgerId, amount: debit };
    if (expected === 'SUPPLIER' && credit > 0) return { partyId: line.ledgerId, amount: credit };
  }
  return null;
}

function recalcReference(
  ref: BillReference,
  adjustments: BillReferenceAdjustment[]
): BillReference {
  const adjustedAmount = roundMoney(
    adjustments.filter((a) => a.referenceId === ref.id).reduce((s, a) => s + Number(a.amount || 0), 0)
  );
  const pendingAmount = roundMoney(Math.max(0, ref.originalAmount - adjustedAmount));
  const status = computeStatus(pendingAmount, adjustedAmount);
  return {
    ...ref,
    adjustedAmount,
    pendingAmount,
    status,
    updatedAt: nowIso(),
  };
}

export const billReferenceService = {
  async list(): Promise<BillReference[]> {
    await this.ensureMigrated();
    return readList<BillReference>(REFERENCES_KEY);
  },

  async listAdjustments(): Promise<BillReferenceAdjustment[]> {
    await this.ensureMigrated();
    return readList<BillReferenceAdjustment>(ADJUSTMENTS_KEY);
  },

  async listForParty(partyId: string): Promise<BillReference[]> {
    const refs = await this.list();
    return refs
      .filter((r) => r.partyId === partyId)
      .sort((a, b) => a.voucherDate.localeCompare(b.voucherDate));
  },

  async listOpenForParty(partyId: string): Promise<BillReference[]> {
    const refs = await this.list();
    return refs
      .filter(
        (r) =>
          r.partyId === partyId &&
          r.pendingAmount > 0.01 &&
          (r.referenceType === 'NEW_REF' || r.referenceType === 'ADVANCE' || r.referenceType === 'ON_ACCOUNT')
      )
      .sort((a, b) => a.voucherDate.localeCompare(b.voucherDate));
  },

  async getPartyOutstanding(partyId: string): Promise<number> {
    const open = await this.listOpenForParty(partyId);
    return roundMoney(open.reduce((s, r) => s + r.pendingAmount, 0));
  },

  async syncInvoiceReference(voucher: Voucher): Promise<BillReference | null> {
    if (voucher.status !== 'ACTIVE' || voucher.isDeleted) return null;
    if (voucher.type !== 'SALES' && voucher.type !== 'PURCHASE') return null;

    const partyType = voucher.type === 'SALES' ? 'CUSTOMER' : 'SUPPLIER';
    const party = await resolvePartyFromVoucher(voucher, partyType);
    if (!party || party.amount <= 0) return null;

    const refs = await readList<BillReference>(REFERENCES_KEY);
    const existingIdx = refs.findIndex((r) => r.voucherId === voucher.id);
    const companyId = getActiveCompanyId();
    const now = nowIso();

    if (existingIdx >= 0) {
      const prev = refs[existingIdx];
      const adjustments = await readList<BillReferenceAdjustment>(ADJUSTMENTS_KEY);
      const updated = recalcReference(
        {
          ...prev,
          referenceNo: voucher.number,
          voucherNumber: voucher.number,
          voucherDate: voucher.date,
          originalAmount: roundMoney(party.amount),
          narration: voucher.narration,
        },
        adjustments
      );
      refs[existingIdx] = updated;
      await writeList(REFERENCES_KEY, refs, { skipSync: true });
      return updated;
    }

    const ref: BillReference = {
      id: generateId('bref'),
      companyId,
      partyId: party.partyId,
      referenceNo: voucher.number,
      referenceType: 'NEW_REF',
      voucherId: voucher.id,
      voucherNumber: voucher.number,
      voucherDate: voucher.date,
      originalAmount: roundMoney(party.amount),
      adjustedAmount: 0,
      pendingAmount: roundMoney(party.amount),
      status: 'OPEN',
      narration: voucher.narration,
      createdAt: now,
      updatedAt: now,
    };
    refs.push(ref);
    await writeList(REFERENCES_KEY, refs, { skipSync: true });
    await logReferenceAudit('REFERENCE_CREATED', ref, { voucherType: voucher.type });
    return ref;
  },

  async onVoucherCancelled(voucher: Voucher): Promise<void> {
    await this.reverseSettlementVoucher(voucher.id);

    if (voucher.type === 'SALES' || voucher.type === 'PURCHASE') {
      const refs = await readList<BillReference>(REFERENCES_KEY);
      const idx = refs.findIndex((r) => r.voucherId === voucher.id && r.referenceType === 'NEW_REF');
      if (idx < 0) return;
      const settled: BillReference = {
        ...refs[idx],
        pendingAmount: 0,
        status: 'SETTLED',
        updatedAt: nowIso(),
      };
      refs[idx] = settled;
      await writeList(REFERENCES_KEY, refs, { skipSync: true });
      await logReferenceAudit('REFERENCE_SETTLED', settled, { reason: 'INVOICE_CANCELLED' });
    }
  },

  async reverseSettlementVoucher(settlementVoucherId: string): Promise<void> {
    const [refs, adjustments] = await Promise.all([
      readList<BillReference>(REFERENCES_KEY),
      readList<BillReferenceAdjustment>(ADJUSTMENTS_KEY),
    ]);

    const remainingAdjustments = adjustments.filter((a) => a.settlementVoucherId !== settlementVoucherId);
    const removedRefIds = new Set(
      adjustments
        .filter((a) => a.settlementVoucherId === settlementVoucherId)
        .map((a) => a.referenceId)
    );

    const remainingRefs = refs.filter(
      (r) =>
        !(
          r.voucherId === settlementVoucherId &&
          (r.referenceType === 'ADVANCE' || r.referenceType === 'ON_ACCOUNT')
        )
    );

    const recalculated = remainingRefs.map((ref) =>
      removedRefIds.has(ref.id) ? recalcReference(ref, remainingAdjustments) : ref
    );

    await writeList(ADJUSTMENTS_KEY, remainingAdjustments, { skipSync: true });
    await writeList(REFERENCES_KEY, recalculated, { skipSync: true });
  },

  async applySettlementVoucher(
    voucher: Voucher,
    settlements: PartySettlementInput[],
    options?: { replaceExisting?: boolean }
  ): Promise<void> {
    if (voucher.type !== 'PAYMENT' && voucher.type !== 'RECEIPT') return;
    if (options?.replaceExisting) {
      await this.reverseSettlementVoucher(voucher.id);
    }

    const companyId = getActiveCompanyId();
    const now = nowIso();
    let refs = await readList<BillReference>(REFERENCES_KEY);
    let adjustments = await readList<BillReferenceAdjustment>(ADJUSTMENTS_KEY);

    for (const settlement of settlements) {
      const amount = roundMoney(settlement.totalAmount);
      if (amount <= 0) continue;

      if (settlement.mode === 'AGAINST_REF') {
        const allocs = settlement.allocations ?? [];
        for (const alloc of allocs) {
          const adjAmount = roundMoney(alloc.amount);
          if (adjAmount <= 0) continue;
          const refIdx = refs.findIndex((r) => r.id === alloc.referenceId);
          if (refIdx < 0) continue;
          const ref = refs[refIdx];
          if (ref.partyId !== settlement.partyId) continue;
          if (adjAmount > ref.pendingAmount + 0.01) {
            throw new Error(`Adjustment exceeds pending for ${ref.referenceNo}`);
          }

          adjustments.push({
            id: generateId('badj'),
            companyId,
            partyId: settlement.partyId,
            referenceId: ref.id,
            settlementVoucherId: voucher.id,
            settlementVoucherNumber: voucher.number,
            settlementVoucherDate: voucher.date,
            amount: adjAmount,
            createdAt: now,
          });

          const updated = recalcReference(ref, adjustments);
          refs[refIdx] = updated;
          await logReferenceAudit(
            updated.status === 'SETTLED' ? 'REFERENCE_SETTLED' : 'REFERENCE_ADJUSTED',
            updated,
            {
              settlementVoucherId: voucher.id,
              adjustedBy: adjAmount,
            }
          );
        }
        continue;
      }

      const refType: BillReferenceType = settlement.mode === 'ADVANCE' ? 'ADVANCE' : 'ON_ACCOUNT';
      const ref: BillReference = {
        id: generateId('bref'),
        companyId,
        partyId: settlement.partyId,
        referenceNo: `${refType === 'ADVANCE' ? 'ADV' : 'OA'}-${voucher.number}`,
        referenceType: refType,
        voucherId: voucher.id,
        voucherNumber: voucher.number,
        voucherDate: voucher.date,
        originalAmount: amount,
        adjustedAmount: 0,
        pendingAmount: amount,
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
      };
      refs.push(ref);
      await logReferenceAudit('REFERENCE_CREATED', ref, { settlementMode: settlement.mode });
    }

    await writeList(ADJUSTMENTS_KEY, adjustments, { skipSync: true });
    await writeList(REFERENCES_KEY, refs, { skipSync: true });
  },

  async getAdjustmentsForVoucher(voucherId: string): Promise<BillReferenceAdjustment[]> {
    const adjustments = await this.listAdjustments();
    return adjustments.filter((a) => a.settlementVoucherId === voucherId);
  },

  async getAdjustmentsAgainstReference(referenceId: string): Promise<BillReferenceAdjustment[]> {
    const adjustments = await this.listAdjustments();
    return adjustments.filter((a) => a.referenceId === referenceId);
  },

  async ensureMigrated(): Promise<void> {
    const flag = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (flag === 'done') return;
    await this.runMigration({ dryRun: false });
    localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
  },

  async previewMigration(): Promise<BillReferenceMigrationPreview> {
    return this.runMigration({ dryRun: true });
  },

  async runMigration(options?: { dryRun?: boolean }): Promise<BillReferenceMigrationPreview> {
    const dryRun = options?.dryRun ?? false;
    const preview = await this.migrateFromLegacyVouchers(dryRun);
    if (!dryRun) {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
      await this.runSettlementAuditAfterChange('migration');
    }
    return preview;
  },

  async runSettlementAudit(): Promise<BillReferenceSettlementAudit> {
    const [refs, adjustments, vouchers] = await Promise.all([
      this.list(),
      this.listAdjustments(),
      voucherService.list(),
    ]);
    const voucherIds = new Set(vouchers.filter((v) => !v.isDeleted && v.status === 'ACTIVE').map((v) => v.id));
    const rows: BillReferenceSettlementAuditRow[] = [];
    let orphanReferences = 0;

    for (const ref of refs) {
      const issues: string[] = [];
      if (ref.originalAmount < -TOLERANCE) issues.push('Original amount is negative');
      if (ref.adjustedAmount < -TOLERANCE) issues.push('Adjusted amount is negative');
      if (ref.pendingAmount < -TOLERANCE) issues.push('Pending amount is negative');
      if (ref.adjustedAmount > ref.originalAmount + TOLERANCE) {
        issues.push('Adjusted exceeds original');
      }
      const expectedPending = roundMoney(Math.max(0, ref.originalAmount - ref.adjustedAmount));
      if (Math.abs(ref.pendingAmount - expectedPending) > TOLERANCE) {
        issues.push(`Pending ₹${ref.pendingAmount} ≠ expected ₹${expectedPending}`);
      }
      if (ref.status === 'SETTLED' && ref.pendingAmount > TOLERANCE) {
        issues.push('Status SETTLED but pending > 0');
      }
      if (ref.status === 'OPEN' && ref.adjustedAmount > TOLERANCE && ref.pendingAmount > TOLERANCE) {
        // status should be PARTIALLY_SETTLED — informational
      }
      const isOpening = ref.voucherId.startsWith('opening-');
      if (!isOpening && !voucherIds.has(ref.voucherId)) {
        issues.push('Orphan reference — source voucher missing');
        orphanReferences += 1;
      }
      const refAdjs = adjustments.filter((a) => a.referenceId === ref.id);
      const adjSum = roundMoney(refAdjs.reduce((s, a) => s + Number(a.amount || 0), 0));
      if (Math.abs(adjSum - ref.adjustedAmount) > TOLERANCE) {
        issues.push(`Adjustment sum ₹${adjSum} ≠ adjustedAmount ₹${ref.adjustedAmount}`);
      }
      for (const adj of refAdjs) {
        if (!voucherIds.has(adj.settlementVoucherId)) {
          issues.push(`Orphan adjustment — settlement voucher ${adj.settlementVoucherNumber} missing`);
        }
      }

      rows.push({
        referenceId: ref.id,
        referenceNo: ref.referenceNo,
        partyId: ref.partyId,
        referenceType: ref.referenceType,
        valid: issues.length === 0,
        issues,
      });
    }

    const invalidReferences = rows.filter((r) => !r.valid).length;
    const negativePending = refs.filter((r) => r.pendingAmount < -TOLERANCE).length;
    const settledWithPending = refs.filter((r) => r.status === 'SETTLED' && r.pendingAmount > TOLERANCE).length;

    const checks = [
      {
        id: 'non_negative',
        label: 'Reference amounts never negative',
        valid: negativePending === 0,
        detail: negativePending ? `${negativePending} reference(s) with negative pending` : 'All amounts ≥ 0',
      },
      {
        id: 'adjusted_lte_original',
        label: 'Adjusted ≤ Original',
        valid: refs.every((r) => r.adjustedAmount <= r.originalAmount + TOLERANCE),
        detail: 'All references respect original amount cap',
      },
      {
        id: 'pending_correct',
        label: 'Pending = Original − Adjusted',
        valid: rows.every((r) => !r.issues.some((i) => i.includes('Pending'))),
        detail: 'Pending amounts recalculated correctly',
      },
      {
        id: 'settled_zero',
        label: 'Settled references have zero pending',
        valid: settledWithPending === 0,
        detail: settledWithPending ? `${settledWithPending} SETTLED with pending > 0` : 'All settled refs at ₹0 pending',
      },
      {
        id: 'no_orphans',
        label: 'No orphan references',
        valid: orphanReferences === 0,
        detail: orphanReferences ? `${orphanReferences} orphan reference(s)` : 'Every reference links to a voucher',
      },
    ];

    return {
      valid: invalidReferences === 0 && checks.every((c) => c.valid),
      totalReferences: refs.length,
      invalidReferences,
      orphanReferences,
      rows,
      checks,
    };
  },

  async assertSettlementIntegrity(context?: string): Promise<BillReferenceSettlementAudit> {
    const audit = await this.runSettlementAudit();
    if (!audit.valid) {
      const detail = audit.rows
        .filter((r) => !r.valid)
        .slice(0, 5)
        .map((r) => `${r.referenceNo}: ${r.issues.join('; ')}`)
        .join(' | ');
      throw new Error(
        `Bill-wise settlement integrity failed${context ? ` (${context})` : ''}: ${detail || `${audit.invalidReferences} invalid reference(s)`}`
      );
    }
    return audit;
  },

  async runSettlementAuditAfterChange(context: string): Promise<BillReferenceSettlementAudit> {
    const audit = await this.runSettlementAudit();
    if (!audit.valid) {
      console.warn(`[bill-reference] settlement audit after ${context}`, audit);
    }
    return audit;
  },

  /** Capture current settlement allocations before reverse (payment/receipt edit). */
  async exportSettlementsForVoucher(voucher: Voucher): Promise<PartySettlementInput[]> {
    if (voucher.type !== 'PAYMENT' && voucher.type !== 'RECEIPT') return [];

    const partyType = voucher.type === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER';
    const party = await resolvePartyFromVoucher(voucher, partyType);
    if (!party || party.amount <= 0) return [];

    const adjustments = await this.getAdjustmentsForVoucher(voucher.id);
    if (adjustments.length > 0) {
      const allocations = adjustments.map((a) => ({
        referenceId: a.referenceId,
        amount: roundMoney(a.amount),
      }));
      const totalAmount = roundMoney(allocations.reduce((s, a) => s + a.amount, 0));
      return [
        {
          partyId: party.partyId,
          partyType,
          mode: 'AGAINST_REF',
          totalAmount,
          allocations,
        },
      ];
    }

    const refs = await readList<BillReference>(REFERENCES_KEY);
    const mode = parseSettlementMode(voucher.narration) ?? 'ON_ACCOUNT';
    const amount = roundMoney(party.amount);
    const allocMap = parseInvoiceAllocations(voucher.narration);

    if (mode === 'AGAINST_REF' && Object.keys(allocMap).length > 0) {
      const allocations: Array<{ referenceId: string; amount: number }> = [];
      for (const [invoiceNo, allocAmount] of Object.entries(allocMap)) {
        const ref = refs.find(
          (r) =>
            r.partyId === party.partyId &&
            r.referenceType === 'NEW_REF' &&
            (r.referenceNo === invoiceNo || r.voucherNumber === invoiceNo)
        );
        if (!ref) continue;
        allocations.push({ referenceId: ref.id, amount: roundMoney(allocAmount) });
      }
      if (allocations.length > 0) {
        return [
          {
            partyId: party.partyId,
            partyType,
            mode: 'AGAINST_REF',
            totalAmount: roundMoney(allocations.reduce((s, a) => s + a.amount, 0)),
            allocations,
          },
        ];
      }
    }

    return [{ partyId: party.partyId, partyType, mode, totalAmount: amount }];
  },

  /** Rebuild settlement rows after voucher restore from narration + open refs. */
  async restoreSettlementForVoucher(voucher: Voucher): Promise<void> {
    if (voucher.type !== 'PAYMENT' && voucher.type !== 'RECEIPT') return;
    if (voucher.status !== 'ACTIVE') return;
    const settlements = await this.exportSettlementsForVoucher(voucher);
    if (settlements.length === 0) return;
    await this.applySettlementVoucher(voucher, settlements, { replaceExisting: true });
  },

  /** @deprecated use runMigration */
  async migrateFromLegacyVouchers(dryRun = false): Promise<BillReferenceMigrationPreview> {
    const vouchers = (await voucherService.list()).filter((v) => !v.isDeleted && v.status === 'ACTIVE');
    const companyId = getActiveCompanyId();
    const now = nowIso();
    const refs: BillReference[] = [];
    const adjustments: BillReferenceAdjustment[] = [];

    const upsertRef = (ref: BillReference) => {
      const idx = refs.findIndex((r) => r.voucherId === ref.voucherId && r.referenceType === ref.referenceType);
      if (idx >= 0) refs[idx] = ref;
      else refs.push(ref);
    };

    for (const voucher of vouchers) {
      if (voucher.type === 'SALES' || voucher.type === 'PURCHASE') {
        const partyType = voucher.type === 'SALES' ? 'CUSTOMER' : 'SUPPLIER';
        const party = await resolvePartyFromVoucher(voucher, partyType);
        if (!party || party.amount <= 0) continue;
        upsertRef({
          id: generateId('bref'),
          companyId,
          partyId: party.partyId,
          referenceNo: voucher.number,
          referenceType: 'NEW_REF',
          voucherId: voucher.id,
          voucherNumber: voucher.number,
          voucherDate: voucher.date,
          originalAmount: roundMoney(party.amount),
          adjustedAmount: 0,
          pendingAmount: roundMoney(party.amount),
          status: 'OPEN',
          createdAt: voucher.createdAt || now,
          updatedAt: now,
        });
      }
    }

    const settlementVouchers = vouchers
      .filter((v) => v.type === 'RECEIPT' || v.type === 'PAYMENT')
      .sort((a, b) => `${a.date}`.localeCompare(`${b.date}`));

    for (const voucher of settlementVouchers) {
      const partyType = voucher.type === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER';
      const party = await resolvePartyFromVoucher(voucher, partyType);
      if (!party) continue;

      const mode = parseSettlementMode(voucher.narration) ?? 'AGAINST_REF';
      const amount = roundMoney(party.amount);
      if (amount <= 0) continue;

      if (mode === 'ADVANCE' || mode === 'ON_ACCOUNT') {
        upsertRef({
          id: generateId('bref'),
          companyId,
          partyId: party.partyId,
          referenceNo: `${mode === 'ADVANCE' ? 'ADV' : 'OA'}-${voucher.number}`,
          referenceType: mode === 'ADVANCE' ? 'ADVANCE' : 'ON_ACCOUNT',
          voucherId: voucher.id,
          voucherNumber: voucher.number,
          voucherDate: voucher.date,
          originalAmount: amount,
          adjustedAmount: 0,
          pendingAmount: amount,
          status: 'OPEN',
          createdAt: voucher.createdAt || now,
          updatedAt: now,
        });
        continue;
      }

      const allocMap = parseInvoiceAllocations(voucher.narration);
      const allocEntries = Object.entries(allocMap);

      if (allocEntries.length === 0) {
        let remaining = amount;
        const openRefs = refs
          .filter((r) => r.partyId === party.partyId && r.referenceType === 'NEW_REF')
          .sort((a, b) => a.voucherDate.localeCompare(b.voucherDate));
        for (const ref of openRefs) {
          if (remaining <= 0.01) break;
          const pending = roundMoney(ref.originalAmount - ref.adjustedAmount);
          if (pending <= 0.01) continue;
          const adjAmount = Math.min(pending, remaining);
          adjustments.push({
            id: generateId('badj'),
            companyId,
            partyId: party.partyId,
            referenceId: ref.id,
            settlementVoucherId: voucher.id,
            settlementVoucherNumber: voucher.number,
            settlementVoucherDate: voucher.date,
            amount: roundMoney(adjAmount),
            createdAt: voucher.createdAt || now,
          });
          ref.adjustedAmount = roundMoney(ref.adjustedAmount + adjAmount);
          ref.pendingAmount = roundMoney(Math.max(0, ref.originalAmount - ref.adjustedAmount));
          ref.status = computeStatus(ref.pendingAmount, ref.adjustedAmount);
          remaining = roundMoney(remaining - adjAmount);
        }
        continue;
      }

      for (const [invoiceNo, allocAmount] of allocEntries) {
        const ref = refs.find(
          (r) =>
            r.partyId === party.partyId &&
            r.referenceType === 'NEW_REF' &&
            (r.referenceNo === invoiceNo || r.voucherNumber === invoiceNo)
        );
        if (!ref) continue;
        const adjAmount = roundMoney(allocAmount);
        if (adjAmount <= 0) continue;
        adjustments.push({
          id: generateId('badj'),
          companyId,
          partyId: party.partyId,
          referenceId: ref.id,
          settlementVoucherId: voucher.id,
          settlementVoucherNumber: voucher.number,
          settlementVoucherDate: voucher.date,
          amount: adjAmount,
          createdAt: voucher.createdAt || now,
        });
        ref.adjustedAmount = roundMoney(ref.adjustedAmount + adjAmount);
        ref.pendingAmount = roundMoney(Math.max(0, ref.originalAmount - ref.adjustedAmount));
        ref.status = computeStatus(ref.pendingAmount, ref.adjustedAmount);
      }
    }

    const ledgers = await ledgerAccountService.list({ includeInactive: false });
    for (const ledger of ledgers) {
      const balance = roundMoney(Number(ledger.currentBalance ?? 0));
      if (Math.abs(balance) <= 0.01) continue;
      const isCustomer = CUSTOMER_GROUPS.has(ledger.groupId);
      const isSupplier = SUPPLIER_GROUPS.has(ledger.groupId);
      if (!isCustomer && !isSupplier) continue;

      const outstanding = isCustomer ? Math.max(0, balance) : Math.max(0, -balance);
      if (outstanding <= 0.01) continue;

      const pendingFromRefs = roundMoney(
        refs
          .filter((r) => r.partyId === ledger.id)
          .reduce((s, r) => s + roundMoney(r.originalAmount - r.adjustedAmount), 0)
      );
      const gap = roundMoney(outstanding - pendingFromRefs);
      if (gap <= 0.01) continue;

      upsertRef({
        id: generateId('bref'),
        companyId,
        partyId: ledger.id,
        referenceNo: `OPEN-${ledger.id.slice(-6)}`,
        referenceType: 'ON_ACCOUNT',
        voucherId: `opening-${ledger.id}`,
        voucherNumber: 'OPENING',
        voucherDate: now.slice(0, 10),
        originalAmount: gap,
        adjustedAmount: 0,
        pendingAmount: gap,
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
      });
    }

    const finalRefs = refs.map((ref) => recalcReference(ref, adjustments));
    const preview: BillReferenceMigrationPreview = {
      invoiceRefs: finalRefs.filter((r) => r.referenceType === 'NEW_REF').length,
      settlementAdjustments: adjustments.length,
      advanceOnAccountRefs: finalRefs.filter((r) => r.referenceType === 'ADVANCE' || r.referenceType === 'ON_ACCOUNT').length,
      openingBalanceRefs: finalRefs.filter((r) => r.voucherId.startsWith('opening-')).length,
      totalReferences: finalRefs.length,
      messages: [
        `${finalRefs.filter((r) => r.referenceType === 'NEW_REF').length} invoice/bill NEW_REF`,
        `${adjustments.length} settlement adjustment(s)`,
        `${finalRefs.filter((r) => r.referenceType === 'ADVANCE').length} advance`,
        `${finalRefs.filter((r) => r.referenceType === 'ON_ACCOUNT').length} on-account`,
        `${finalRefs.filter((r) => r.voucherId.startsWith('opening-')).length} opening balance ref(s)`,
      ],
    };

    if (!dryRun) {
      await writeList(REFERENCES_KEY, finalRefs, { skipSync: true });
      await writeList(ADJUSTMENTS_KEY, adjustments, { skipSync: true });
    }
    return preview;
  },
};

export const settlementParseUtils = {
  parseInvoiceAllocations,
  parseSettlementMode,
};

export type { BillReference, BillReferenceAdjustment };
