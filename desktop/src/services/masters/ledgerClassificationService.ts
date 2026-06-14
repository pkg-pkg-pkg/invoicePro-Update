import type { LedgerAccount } from '../../types/masters';
import {
  LEGACY_CASH_BANK_GROUP_ID,
  SYSTEM_LEDGER_IDS,
  STANDARD_SUBGROUP_IDS,
} from '../../constants/chartOfAccounts';
import { inferLedgerRole, expectedGroupForLedger, type LedgerClassificationRole } from './ledgerRoleInference';
import { ledgerAccountService } from './ledgerAccountService';
import { ledgerGroupService } from './ledgerGroupService';
import { ledgerTransactionService } from './ledgerTransactionService';
import { partyService } from './partyService';
import { readList, writeList } from './storageHelpers';

export type { LedgerClassificationRole } from './ledgerRoleInference';
export { inferLedgerRole, expectedGroupForLedger } from './ledgerRoleInference';

export type LedgerAuditRow = {
  ledgerId: string;
  ledgerName: string;
  currentGroupId: string;
  currentGroupName: string;
  expectedGroupId: string;
  expectedGroupName: string;
  role: LedgerClassificationRole;
  mismatch: boolean;
  autoCreated: boolean;
  unused: boolean;
  duplicateOf?: string;
};

export type AccountingStructureSummary = {
  totalLedgers: number;
  correctlyClassified: number;
  misclassified: number;
  unused: number;
  duplicates: number;
  legacyGroupLedgers: number;
};

export type AccountingStructureAudit = {
  generatedAt: string;
  summary: AccountingStructureSummary;
  rows: LedgerAuditRow[];
  migrationPlan: MigrationStep[];
};

export type MigrationStep = {
  ledgerId: string;
  ledgerName: string;
  fromGroupId: string;
  toGroupId: string;
  reason: string;
  safe: boolean;
};

async function buildPartyLedgerMap(): Promise<Map<string, 'customer' | 'supplier'>> {
  const map = new Map<string, 'customer' | 'supplier'>();
  try {
    const parties = await partyService.list();
    for (const p of parties) {
      if (!p.ledgerId) continue;
      const pt = String(p.partyType ?? '').toUpperCase();
      if (pt === 'SUPPLIER') map.set(p.ledgerId, 'supplier');
      else map.set(p.ledgerId, 'customer');
    }
  } catch {
    // optional
  }
  return map;
}

async function ledgerHasActivity(ledgerId: string): Promise<boolean> {
  const txns = await ledgerTransactionService.list({ ledgerId });
  return txns.length > 0;
}

export const ledgerClassificationService = {
  async runAudit(): Promise<AccountingStructureAudit> {
    const [ledgers, groups] = await Promise.all([
      ledgerAccountService.list({ includeInactive: true }),
      ledgerGroupService.list({ includeInactive: true }),
    ]);
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const partyLinks = await buildPartyLedgerMap();

    const nameIndex = new Map<string, string>();
    const duplicateIds = new Set<string>();
    const normalizeName = (name: string) => String(name ?? '').trim().toLowerCase();
    for (const l of ledgers) {
      const key = normalizeName(l.name);
      if (!key) continue;
      const prev = nameIndex.get(key);
      if (prev) {
        duplicateIds.add(l.id);
        duplicateIds.add(prev);
      } else {
        nameIndex.set(key, l.id);
      }
    }

    const activityChecks = await Promise.all(
      ledgers.map(async (l) => ({
        id: l.id,
        hasActivity: await ledgerHasActivity(l.id),
      }))
    );
    const activityMap = new Map(activityChecks.map((a) => [a.id, a.hasActivity]));

    const rows: LedgerAuditRow[] = [];
    let misclassified = 0;
    let unused = 0;
    let legacyGroupLedgers = 0;

    for (const ledger of ledgers) {
      const role = inferLedgerRole(ledger, partyLinks);
      const expectedGroupId = expectedGroupForLedger(ledger, role);
      const currentGroup = groupMap.get(ledger.groupId);
      const expectedGroup = groupMap.get(expectedGroupId);
      const mismatch = expectedGroupId !== ledger.groupId && expectedGroupId !== '';
      if (mismatch) misclassified += 1;
      if (ledger.groupId === LEGACY_CASH_BANK_GROUP_ID) legacyGroupLedgers += 1;

      const zeroBal = Math.abs(Number(ledger.currentBalance ?? 0)) < 0.0001;
      const noOpening = Math.abs(Number(ledger.openingBalance ?? 0)) < 0.0001;
      const isUnused =
        ledger.isActive !== false &&
        zeroBal &&
        noOpening &&
        !activityMap.get(ledger.id) &&
        !SYSTEM_LEDGER_IDS.has(ledger.id);
      if (isUnused) unused += 1;

      rows.push({
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        currentGroupId: ledger.groupId,
        currentGroupName: currentGroup?.name ?? ledger.groupId,
        expectedGroupId,
        expectedGroupName: expectedGroup?.name ?? expectedGroupId,
        role,
        mismatch,
        autoCreated: SYSTEM_LEDGER_IDS.has(ledger.id) || partyLinks.has(ledger.id),
        unused: isUnused,
        duplicateOf: duplicateIds.has(ledger.id)
          ? nameIndex.get(normalizeName(ledger.name)) === ledger.id
            ? undefined
            : nameIndex.get(normalizeName(ledger.name))
          : undefined,
      });
    }

    rows.sort((a, b) => {
      if (a.mismatch !== b.mismatch) return a.mismatch ? -1 : 1;
      return a.ledgerName.localeCompare(b.ledgerName);
    });

    const migrationPlan = rows
      .filter((r) => r.mismatch)
      .map((r) => ({
        ledgerId: r.ledgerId,
        ledgerName: r.ledgerName,
        fromGroupId: r.currentGroupId,
        toGroupId: r.expectedGroupId,
        reason: `Auto-classify as ${r.role}`,
        safe: !SYSTEM_LEDGER_IDS.has(r.ledgerId) || r.currentGroupId === LEGACY_CASH_BANK_GROUP_ID,
      }));

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalLedgers: ledgers.length,
        correctlyClassified: ledgers.length - misclassified,
        misclassified,
        unused,
        duplicates: duplicateIds.size,
        legacyGroupLedgers,
      },
      rows,
      migrationPlan,
    };
  },

  async applyMigration(options?: { dryRun?: boolean; ledgerIds?: string[] }) {
    const audit = await this.runAudit();
    const plan = audit.migrationPlan.filter(
      (step) => !options?.ledgerIds?.length || options.ledgerIds.includes(step.ledgerId)
    );
    const details: Array<{ ledgerId: string; ok: boolean; message: string }> = [];
    let applied = 0;
    let skipped = 0;

    if (options?.dryRun) {
      return {
        dryRun: true,
        applied: plan.length,
        skipped: 0,
        details: plan.map((p) => ({
          ledgerId: p.ledgerId,
          ok: true,
          message: `Would move to ${p.toGroupId}: ${p.reason}`,
        })),
      };
    }

    for (const step of plan) {
      if (!step.safe && SYSTEM_LEDGER_IDS.has(step.ledgerId)) {
        skipped += 1;
        details.push({ ledgerId: step.ledgerId, ok: false, message: 'Skipped protected system ledger' });
        continue;
      }
      try {
        await ledgerAccountService.reclassify(step.ledgerId, step.toGroupId);
        applied += 1;
        details.push({ ledgerId: step.ledgerId, ok: true, message: step.reason });
      } catch (e) {
        skipped += 1;
        details.push({ ledgerId: step.ledgerId, ok: false, message: (e as Error).message });
      }
    }

    return { dryRun: false, applied, skipped, details };
  },

  async mergeLedgers(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) throw new Error('Cannot merge a ledger into itself');
    const [source, target] = await Promise.all([
      ledgerAccountService.getById(sourceId),
      ledgerAccountService.getById(targetId),
    ]);
    if (!source || !target) throw new Error('Source or target ledger not found');
    if (source.isActive === false || target.isActive === false) {
      throw new Error('Both ledgers must be active to merge');
    }
    const delta = Number(source.currentBalance ?? 0);
    if (Math.abs(delta) > 0.0001) {
      await ledgerAccountService.adjustCurrentBalance(targetId, delta);
    }
    await ledgerAccountService.softDelete(sourceId);
  },
};

const MIGRATION_FLAG_KEY = 'pve_ledger_classification_migrated_v1';

export async function ensureLedgerClassificationMigration(): Promise<void> {
  const flags = await readList<{ id: string; value: boolean }>('pve_app_flags').catch(
    () => [] as { id: string; value: boolean }[]
  );
  if (flags.some((f) => f.id === MIGRATION_FLAG_KEY && f.value)) return;

  await ledgerClassificationService.applyMigration();
  const next = flags.filter((f) => f.id !== MIGRATION_FLAG_KEY);
  next.push({ id: MIGRATION_FLAG_KEY, value: true });
  await writeList('pve_app_flags', next);
}
