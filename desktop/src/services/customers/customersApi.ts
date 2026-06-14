import type { Party, PartyInput } from '../../types/party';
import type { SalesDocumentStatus } from '../../types/salesDocuments';
import { partyService } from '../masters/partyService';
import { billReferenceService } from '../settlement/billReferenceService';
import { logCustomerAudit, currentAuditUserName } from './customerAuditService';
import { voucherService } from '../vouchers/voucherService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { salesPipelineService } from '../sales/salesDocumentService';
import { voucherGrandTotal } from '../voucherPrintBuilder';
import {
  computeSalesInvoicePaidAmount,
  computeSalesInvoicePaymentStatus,
} from '../vouchers/invoicePaymentStatus';
import type { Voucher } from '../../types/vouchers';
import { generateId } from '../../utils/id';
import { nowIso } from '../masters/storageHelpers';

const COMMENTS_KEY = 'pve_customer_comments';

export type CustomerFilterKey = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'WITH_BALANCE' | 'OVERDUE';

/** Unified party option for dropdowns — ledgerId is the voucher join key. */
export type PartyFilterOption = {
  partyId: string;
  ledgerId: string;
  name: string;
};

const SUNDRY_DEBTOR_GROUP = 'grp-sundry-debtors';
const SUNDRY_CREDITOR_GROUP = 'grp-sundry-creditors';

export type CustomerInvoiceRow = {
  id: string;
  date: string;
  number: string;
  orderNumber: string;
  amount: number;
  balanceDue: number;
  status: SalesDocumentStatus;
  editPath: string;
};

export type CustomerPaymentRow = {
  id: string;
  date: string;
  number: string;
  invoiceNumber: string;
  amount: number;
  mode: string;
  reference: string;
  editPath: string;
};

export type CustomerDocRow = {
  id: string;
  date: string;
  number: string;
  amount: number;
  status: SalesDocumentStatus;
  editPath?: string;
};

export type CustomerStatementRow = {
  date: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
};

export type CustomerComment = {
  id: string;
  text: string;
  createdAt: string;
  userName: string;
};

export type CustomerMailRow = {
  id: string;
  date: string;
  subject: string;
  status: 'Sent' | 'Opened' | 'Failed';
};

export type CustomerTransactionsBundle = {
  invoices: CustomerInvoiceRow[];
  payments: CustomerPaymentRow[];
  creditNotes: CustomerDocRow[];
  salesOrders: CustomerDocRow[];
  deliveryChallans: CustomerDocRow[];
  retainerInvoices: CustomerDocRow[];
  expenses: CustomerDocRow[];
};

function mapPayStatus(voucher: Voucher, all: Voucher[]): SalesDocumentStatus {
  if ((voucher.status ?? 'ACTIVE') === 'CANCELLED') return 'CANCELLED';
  const pay = computeSalesInvoicePaymentStatus(voucher, all);
  if (pay === 'PAID') return 'PAID';
  if (pay === 'PARTIAL') return 'PARTIALLY_PAID';
  if (pay === 'OVERDUE') return 'OVERDUE';
  return 'APPROVED';
}

function voucherMatchesParty(voucher: Voucher, ledgerIds: string[]): boolean {
  if (!ledgerIds.length) return false;
  const set = new Set(ledgerIds);
  return voucher.lines.some((l) => l.ledgerId && set.has(l.ledgerId));
}

async function resolvePartyLedgerIds(party: Party): Promise<string[]> {
  let ledgerId = party.ledgerId ?? (await partyService.getLedgerId(party.id)) ?? undefined;
  if (!ledgerId) {
    ledgerId = (await partyService.ensureLedgerForParty(party.id)) ?? undefined;
  }
  if (!ledgerId) return [];

  const ledger = await ledgerAccountService.getById(ledgerId);
  if (!ledger) return [ledgerId];

  const ledgers = await ledgerAccountService.list({
    includeInactive: false,
    groupId: ledger.groupId,
  });
  const nameKey = ledger.name.trim().toLowerCase();
  const related = ledgers
    .filter((l) => l.name.trim().toLowerCase() === nameKey)
    .map((l) => l.id);
  return related.length ? related : [ledgerId];
}

function invoiceBalance(voucher: Voucher, all: Voucher[]): number {
  const partyLine = voucher.lines.find((l) => Number(l.debit ?? 0) > 0);
  const total = Number(partyLine?.debit ?? 0);
  const paid = computeSalesInvoicePaidAmount(voucher, all);
  return Math.max(0, Number((total - paid).toFixed(2)));
}

function paymentModeFromVoucher(v: Voucher): string {
  const cashBank = v.lines.find((l) => l.ledgerId && l.ledgerId !== v.lines[0]?.ledgerId);
  return cashBank?.ledgerId ? 'Bank/Cash' : '—';
}

function readCommentsMap(): Record<string, CustomerComment[]> {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CustomerComment[]>) : {};
  } catch {
    return {};
  }
}

function writeCommentsMap(map: Record<string, CustomerComment[]>) {
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(map));
}

export const customersApi = {
  async list(filter: CustomerFilterKey, search?: string): Promise<Party[]> {
    const status = filter === 'ACTIVE' ? 'ACTIVE' : filter === 'INACTIVE' ? 'INACTIVE' : undefined;
    let rows = await partyService.list({
      partyType: ['BUYER', 'BOTH'],
      status,
      search: search?.trim() || undefined,
    });
    if (filter === 'WITH_BALANCE' || filter === 'OVERDUE') {
      rows = rows.filter((p) => Math.abs(Number(p.currentBalance ?? p.openingBalance ?? 0)) > 0.01);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: string): Promise<Party | null> {
    return partyService.getById(id);
  },

  async findPartyIdByLedgerId(ledgerId: string): Promise<string | null> {
    const rows = await partyService.list({ partyType: ['BUYER', 'BOTH'] });
    const direct = rows.find((p) => p.ledgerId === ledgerId);
    if (direct) return direct.id;
    const all = await partyService.list({ partyType: ['BUYER', 'BOTH'], status: 'INACTIVE' });
    const inactive = all.find((p) => p.ledgerId === ledgerId);
    return inactive?.id ?? null;
  },

  async create(input: PartyInput): Promise<Party> {
    return partyService.create({ ...input, partyType: input.partyType === 'SUPPLIER' ? 'BOTH' : 'BUYER' });
  },

  async update(id: string, input: Partial<PartyInput>): Promise<Party> {
    return partyService.update(id, input);
  },

  async remove(id: string): Promise<void> {
    await partyService.markInactive(id);
    const party = await partyService.getById(id);
    logCustomerAudit({
      customerId: id,
      customerName: party?.name || id,
      action: 'CUSTOMER_DEACTIVATED',
      userName: currentAuditUserName(),
    });
  },

  async reactivate(id: string): Promise<Party> {
    const updated = await partyService.reactivate(id);
    logCustomerAudit({
      customerId: id,
      customerName: updated.name,
      action: 'CUSTOMER_ACTIVATED',
      userName: currentAuditUserName(),
    });
    return updated;
  },

  async canPermanentlyDelete(id: string) {
    return partyService.canPermanentlyDelete(id);
  },

  async permanentDelete(id: string, options?: { force?: boolean }): Promise<void> {
    const party = await partyService.getById(id);
    await partyService.permanentDelete(id, options);
    logCustomerAudit({
      customerId: id,
      customerName: party?.name || id,
      action: 'CUSTOMER_DELETED',
      userName: currentAuditUserName(),
    });
  },

  async markInactive(id: string): Promise<Party> {
    const updated = await partyService.markInactive(id);
    logCustomerAudit({
      customerId: id,
      customerName: updated.name,
      action: 'CUSTOMER_DEACTIVATED',
      userName: currentAuditUserName(),
    });
    return updated;
  },

  customerBalance(party: Party): number {
    return Number(party.currentBalance ?? party.openingBalance ?? 0);
  },

  async customerOutstanding(party: Party): Promise<number> {
    let ledgerId = party.ledgerId;
    if (!ledgerId) {
      ledgerId = (await partyService.ensureLedgerForParty(party.id)) ?? undefined;
    }
    if (ledgerId) {
      await billReferenceService.ensureMigrated();
      const billOutstanding = await billReferenceService.getPartyOutstanding(ledgerId);
      if (billOutstanding > 0.01) return billOutstanding;
    }
    return this.customerBalance(party);
  },

  /** Customers for sales/collections filter dropdowns (ledgerId = filter value). */
  async listCustomerFilterOptions(): Promise<PartyFilterOption[]> {
    return this.listPartyFilterOptions('customer');
  },

  /** Suppliers for purchase filter dropdowns. */
  async listSupplierFilterOptions(): Promise<PartyFilterOption[]> {
    return this.listPartyFilterOptions('supplier');
  },

  /** All parties with a ledger account — used by Ledger Report & unified dropdowns. */
  async listPartyFilterOptions(scope: 'customer' | 'supplier'): Promise<PartyFilterOption[]> {
    const groupId = scope === 'customer' ? SUNDRY_DEBTOR_GROUP : SUNDRY_CREDITOR_GROUP;
    const partyTypes = scope === 'customer' ? (['BUYER', 'BOTH'] as const) : (['SUPPLIER', 'BOTH'] as const);

    const [parties, ledgers] = await Promise.all([
      partyService.list({ partyType: [...partyTypes] }),
      ledgerAccountService.list({ includeInactive: false, groupId }),
    ]);

    const byLedgerId = new Map<string, PartyFilterOption>();

    for (const party of parties) {
      let ledgerId = party.ledgerId ?? undefined;
      if (!ledgerId) {
        ledgerId = (await partyService.ensureLedgerForParty(party.id)) ?? undefined;
      }
      if (!ledgerId) continue;
      byLedgerId.set(ledgerId, { partyId: party.id, ledgerId, name: party.name });
    }

    for (const ledger of ledgers) {
      if (byLedgerId.has(ledger.id)) continue;
      byLedgerId.set(ledger.id, {
        partyId: `pl-${ledger.id}`,
        ledgerId: ledger.id,
        name: ledger.name,
      });
    }

    return [...byLedgerId.values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Alias for ledger report customer dropdown. */
  async listLedgerCustomerOptions(): Promise<PartyFilterOption[]> {
    return this.listPartyFilterOptions('customer');
  },

  async listLedgerSupplierOptions(): Promise<PartyFilterOption[]> {
    return this.listPartyFilterOptions('supplier');
  },

  async getTransactions(party: Party): Promise<CustomerTransactionsBundle> {
    const [vouchers, pipeline, ledgers] = await Promise.all([
      voucherService.list(),
      salesPipelineService.list(),
      ledgerAccountService.list({ includeInactive: false }),
    ]);
    let ledgerIds = await resolvePartyLedgerIds(party);

    const sales = vouchers.filter(
      (v) => v.type === 'SALES' && voucherMatchesParty(v, ledgerIds)
    );

    const invoices: CustomerInvoiceRow[] = sales.map((v) => ({
      id: v.id,
      date: v.date.slice(0, 10),
      number: v.number,
      orderNumber: '—',
      amount: voucherGrandTotal(v),
      balanceDue: invoiceBalance(v, vouchers),
      status: mapPayStatus(v, vouchers),
      editPath: `/sales/invoices/${v.id}`,
    }));

    const payments: CustomerPaymentRow[] = vouchers
      .filter((v) => v.type === 'RECEIPT' && voucherMatchesParty(v, ledgerIds))
      .map((v) => ({
        id: v.id,
        date: v.date.slice(0, 10),
        number: v.number,
        invoiceNumber: String(v.narration ?? '').match(/INVALLOC\[(.+?)\]/)?.[1] ?? '—',
        amount: voucherGrandTotal(v),
        mode: paymentModeFromVoucher(v),
        reference: v.narration?.slice(0, 80) ?? '—',
        editPath: `/vouchers/receipt-vouchers/${v.id}/edit`,
      }));

    const creditNotes: CustomerDocRow[] = vouchers
      .filter((v) => v.type === 'SALES_RETURN' && voucherMatchesParty(v, ledgerIds))
      .map((v) => ({
        id: v.id,
        date: v.date.slice(0, 10),
        number: v.number,
        amount: voucherGrandTotal(v),
        status: (v.status ?? 'ACTIVE') === 'CANCELLED' ? 'CANCELLED' : 'APPROVED',
        editPath: '/vouchers/sales-return',
      }));

    const matchPipeline = (kind: string) =>
      pipeline
        .filter(
          (p) =>
            p.kind === kind &&
            (p.customerId === party.id ||
              p.customerName.trim().toLowerCase() === party.name.trim().toLowerCase())
        )
        .map((p) => ({
          id: p.id,
          date: p.date,
          number: p.number,
          amount: p.amount,
          status: p.status,
        }));

    return {
      invoices,
      payments,
      creditNotes,
      salesOrders: matchPipeline('sales-orders'),
      deliveryChallans: matchPipeline('dispatch'),
      retainerInvoices: matchPipeline('proforma'),
      expenses: [],
    };
  },

  async getStatement(party: Party, from: string, to: string): Promise<CustomerStatementRow[]> {
    const bundle = await this.getTransactions(party);
    const rows: CustomerStatementRow[] = [];
    let running = Number(party.openingBalance ?? 0);

    const push = (date: string, particulars: string, debit: number, credit: number) => {
      if (date < from || date > to) return;
      running = Number((running + debit - credit).toFixed(2));
      rows.push({ date, particulars, debit, credit, balance: running });
    };

    bundle.invoices.forEach((inv) => push(inv.date, `Invoice ${inv.number}`, inv.amount, 0));
    bundle.payments.forEach((p) => push(p.date, `Receipt ${p.number}`, 0, p.amount));
    bundle.creditNotes.forEach((c) => push(c.date, `Credit Note ${c.number}`, 0, c.amount));

    return rows.sort((a, b) => a.date.localeCompare(b.date));
  },

  listComments(partyId: string): CustomerComment[] {
    return readCommentsMap()[partyId] ?? [];
  },

  addComment(partyId: string, text: string, userName: string): CustomerComment[] {
    const map = readCommentsMap();
    const entry: CustomerComment = {
      id: generateId('cmt'),
      text: text.trim(),
      createdAt: nowIso(),
      userName: userName || 'User',
    };
    map[partyId] = [entry, ...(map[partyId] ?? [])];
    writeCommentsMap(map);
    return map[partyId];
  },

  listMails(_partyId: string): CustomerMailRow[] {
    return [];
  },
};
