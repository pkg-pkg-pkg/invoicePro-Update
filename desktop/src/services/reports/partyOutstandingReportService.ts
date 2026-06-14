import type { BillReference } from '../../types/billReference';
import { billReferenceService } from '../settlement/billReferenceService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { partyService } from '../masters/partyService';
import { buildOutstandingAging } from '../../utils/outstandingAging';

export type PartyOutstandingRow = {
  ledgerId: string;
  partyId?: string;
  partyName: string;
  partyKind: 'DEBTOR' | 'CREDITOR';
  ledgerBalance: number;
  billOutstanding: number;
  openReferenceCount: number;
  references: BillReference[];
  ageingTotal: number;
  ageingBuckets: ReturnType<typeof buildOutstandingAging>['buckets'];
};

export type PartyOutstandingReport = {
  generatedAt: string;
  debtors: PartyOutstandingRow[];
  creditors: PartyOutstandingRow[];
  totalDebtorOutstanding: number;
  totalCreditorOutstanding: number;
};

const DEBTOR_GROUP = 'grp-sundry-debtors';
const CREDITOR_GROUP = 'grp-sundry-creditors';

export async function loadPartyOutstandingReport(): Promise<PartyOutstandingReport> {
  await billReferenceService.ensureMigrated();
  const [ledgers, refs, parties] = await Promise.all([
    ledgerAccountService.list({ includeInactive: false }),
    billReferenceService.list(),
    partyService.list(),
  ]);

  const partyByLedger = new Map(parties.filter((p) => p.ledgerId).map((p) => [p.ledgerId!, p.id]));

  const refsByParty = new Map<string, BillReference[]>();
  for (const ref of refs) {
    const list = refsByParty.get(ref.partyId) ?? [];
    list.push(ref);
    refsByParty.set(ref.partyId, list);
  }

  const buildRow = (ledger: (typeof ledgers)[0], kind: 'DEBTOR' | 'CREDITOR'): PartyOutstandingRow => {
    const partyRefs = refsByParty.get(ledger.id) ?? [];
    const openRefs = partyRefs.filter((r) => r.pendingAmount > 0.01);
    const billOutstanding = openRefs.reduce((s, r) => s + r.pendingAmount, 0);
    const balance = Number(ledger.currentBalance ?? 0);
    const ledgerBalance = kind === 'DEBTOR' ? Math.max(0, balance) : Math.max(0, -balance);
    const outstanding = billOutstanding > 0.01 ? billOutstanding : ledgerBalance;

    const { buckets, total } = buildOutstandingAging({
      customers: kind === 'DEBTOR' ? [{ id: ledger.id, name: ledger.name, currentBalance: outstanding }] : [],
      billReferences: openRefs,
      ledgerNameById: new Map([[ledger.id, ledger.name]]),
      fallbackTotal: outstanding,
    });

    return {
      ledgerId: ledger.id,
      partyId: partyByLedger.get(ledger.id),
      partyName: ledger.name,
      partyKind: kind,
      ledgerBalance,
      billOutstanding: Number(billOutstanding.toFixed(2)),
      openReferenceCount: openRefs.length,
      references: partyRefs,
      ageingTotal: total,
      ageingBuckets: buckets,
    };
  };

  const debtors = ledgers
    .filter((l) => l.groupId === DEBTOR_GROUP)
    .map((l) => buildRow(l, 'DEBTOR'))
    .filter((r) => r.billOutstanding > 0.01 || r.ledgerBalance > 0.01)
    .sort((a, b) => b.billOutstanding - a.billOutstanding);

  const creditors = ledgers
    .filter((l) => l.groupId === CREDITOR_GROUP)
    .map((l) => buildRow(l, 'CREDITOR'))
    .filter((r) => r.billOutstanding > 0.01 || r.ledgerBalance > 0.01)
    .sort((a, b) => b.billOutstanding - a.billOutstanding);

  return {
    generatedAt: new Date().toISOString(),
    debtors,
    creditors,
    totalDebtorOutstanding: Number(debtors.reduce((s, r) => s + r.billOutstanding, 0).toFixed(2)),
    totalCreditorOutstanding: Number(creditors.reduce((s, r) => s + r.billOutstanding, 0).toFixed(2)),
  };
}
