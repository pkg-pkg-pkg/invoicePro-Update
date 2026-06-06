import {
  SalesDocKind,
  SalesDocumentRow,
  SalesDocumentStatus,
  SalesPipelineDocument,
} from '../../types/salesDocuments';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from '../masters/storageHelpers';
import { voucherService } from '../vouchers/voucherService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import {
  computeSalesInvoicePaidAmount,
  computeSalesInvoicePaymentStatus,
  parseDueDateToken,
} from '../vouchers/invoicePaymentStatus';
import { voucherGrandTotal } from '../voucherPrintBuilder';
import { calcSalesDocumentTotals, generatePipelineNumber } from './salesPipelineCalc';
import type { Voucher } from '../../types/vouchers';
import { normalizeToYmd } from '../../utils/dateRange';

const STORAGE_KEY = 'pve_sales_pipeline';

function normalizePipelineDoc(raw: SalesPipelineDocument): SalesPipelineDocument {
  const amount = Number(raw.grandTotal ?? raw.amount ?? 0);
  return {
    ...raw,
    lines: Array.isArray(raw.lines) ? raw.lines : [],
    header: raw.header ?? {},
    amount,
    grandTotal: Number(raw.grandTotal ?? raw.amount ?? 0),
  };
}

export const salesPipelineService = {
  async list(kind?: SalesDocKind): Promise<SalesPipelineDocument[]> {
    const rows = (await readList<SalesPipelineDocument>(STORAGE_KEY)).map(normalizePipelineDoc);
    return rows
      .filter((r) => !kind || r.kind === kind)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getById(id: string): Promise<SalesPipelineDocument | null> {
    const rows = await readList<SalesPipelineDocument>(STORAGE_KEY);
    const found = rows.find((r) => r.id === id);
    return found ? normalizePipelineDoc(found) : null;
  },

  async nextNumber(kind: SalesDocKind): Promise<string> {
    const rows = await this.list(kind);
    return generatePipelineNumber(kind, rows.length);
  },

  async create(payload: Partial<SalesPipelineDocument>): Promise<SalesPipelineDocument> {
    const rows = await readList<SalesPipelineDocument>(STORAGE_KEY);
    const kind = payload.kind as SalesDocKind;
    if (!kind) throw new Error('Document kind is required');

    const customerName = sanitizeString(payload.customerName ?? null);
    if (!customerName) throw new Error('Customer name is required');

    const lines = payload.lines ?? [];
    const totals = calcSalesDocumentTotals(lines, {
      freight: payload.header?.freightCharges,
      insurance: payload.header?.insurance,
      roundOff: payload.header?.roundOff,
      placeOfSupply: payload.header?.placeOfSupply ?? undefined,
    });

    const number =
      sanitizeString(payload.number ?? null) ||
      generatePipelineNumber(kind, rows.filter((r) => r.kind === kind).length);

    const now = nowIso();
    const row: SalesPipelineDocument = normalizePipelineDoc({
      id: payload.id ?? generateId('sdoc'),
      kind,
      number,
      date: payload.date ?? now.slice(0, 10),
      customerId: sanitizeString(payload.customerId ?? null),
      customerName,
      amount: Number(payload.grandTotal ?? totals.grandTotal ?? payload.amount ?? 0),
      status: payload.status ?? 'DRAFT',
      dueDate: payload.dueDate ?? null,
      notes: sanitizeString(payload.notes ?? null),
      convertedVoucherId: payload.convertedVoucherId ?? null,
      lines,
      header: payload.header ?? {},
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      grandTotal: totals.grandTotal,
      amountInWords: totals.amountInWords,
      createdAt: now,
      updatedAt: now,
    });

    rows.push(row);
    await writeList(STORAGE_KEY, rows);
    return row;
  },

  async update(id: string, patch: Partial<SalesPipelineDocument>): Promise<SalesPipelineDocument> {
    const rows = await readList<SalesPipelineDocument>(STORAGE_KEY);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Document not found');
    const current = normalizePipelineDoc(rows[idx]);
    const lines = patch.lines ?? current.lines;
    const header = { ...current.header, ...(patch.header ?? {}) };
    const totals = calcSalesDocumentTotals(lines, {
      freight: header.freightCharges,
      insurance: header.insurance,
      roundOff: header.roundOff,
      placeOfSupply: header.placeOfSupply ?? undefined,
    });
    const updated: SalesPipelineDocument = normalizePipelineDoc({
      ...current,
      ...patch,
      id: current.id,
      kind: current.kind,
      customerName: sanitizeString(patch.customerName ?? current.customerName) ?? current.customerName,
      lines,
      header,
      amount: Number(patch.grandTotal ?? totals.grandTotal ?? current.amount),
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      grandTotal: totals.grandTotal,
      amountInWords: totals.amountInWords,
      updatedAt: nowIso(),
    });
    rows[idx] = updated;
    await writeList(STORAGE_KEY, rows);
    return updated;
  },

  async remove(ids: string[]): Promise<void> {
    const set = new Set(ids);
    const rows = await readList<SalesPipelineDocument>(STORAGE_KEY);
    await writeList(
      STORAGE_KEY,
      rows.filter((r) => !set.has(r.id))
    );
  },
};

function partyFromVoucher(voucher: Voucher, ledgerMap: Map<string, string>): { id?: string; name: string } {
  const customerLine =
    voucher.type === 'SALES' || voucher.type === 'SALES_RETURN'
      ? voucher.lines.find((l) => Number(l.debit ?? 0) > 0)
      : voucher.type === 'PURCHASE' || voucher.type === 'PURCHASE_RETURN'
        ? voucher.lines.find((l) => Number(l.credit ?? 0) > 0)
        : voucher.lines.find((l) => Number(l.debit ?? 0) > 0 || Number(l.credit ?? 0) > 0);
  const paymentLine =
    voucher.type === 'RECEIPT'
      ? voucher.lines.find((l) => Number(l.credit ?? 0) > 0)
      : voucher.type === 'PAYMENT'
        ? voucher.lines.find((l) => Number(l.debit ?? 0) > 0)
        : undefined;
  const partyLine = customerLine ?? paymentLine ?? voucher.lines[0];
  const id = partyLine?.ledgerId;
  return { id, name: (id && ledgerMap.get(id)) || '—' };
}

function mapPaymentToSalesStatus(
  voucher: Voucher,
  allVouchers: Voucher[]
): SalesDocumentStatus {
  if ((voucher.status ?? 'ACTIVE') === 'CANCELLED') return 'CANCELLED';
  const pay = computeSalesInvoicePaymentStatus(voucher, allVouchers);
  if (pay === 'PAID') return 'PAID';
  if (pay === 'PARTIAL') return 'PARTIALLY_PAID';
  if (pay === 'OVERDUE') return 'OVERDUE';
  return 'APPROVED';
}

function voucherGstTotal(voucher: Voucher): number {
  return (voucher.lines ?? []).reduce(
    (sum, line) =>
      sum + Number(line.cgstAmount ?? 0) + Number(line.sgstAmount ?? 0) + Number(line.igstAmount ?? 0),
    0
  );
}

function salesInvoiceBalanceDue(voucher: Voucher, allVouchers: Voucher[]): number {
  const partyLine = (voucher.lines ?? []).find((line) => Number(line.debit ?? 0) > 0);
  const total = Number(partyLine?.debit ?? 0);
  if (total <= 0) return 0;
  const paid = computeSalesInvoicePaidAmount(voucher, allVouchers);
  return Math.max(0, Number((total - paid).toFixed(2)));
}

function pipelineToRow(doc: SalesPipelineDocument): SalesDocumentRow {
  const normalized = normalizePipelineDoc(doc);
  const gstAmount = Number(normalized.cgst ?? 0) + Number(normalized.sgst ?? 0) + Number(normalized.igst ?? 0);
  const grandTotal = Number(normalized.grandTotal ?? normalized.amount ?? 0);
  const balanceDue =
    normalized.status === 'PAID' || normalized.status === 'PAYMENT_RECEIVED' ? 0 : grandTotal;
  return {
    id: normalized.id,
    kind: normalized.kind,
    number: normalized.number,
    date: normalized.date,
    customerId: normalized.customerId ?? undefined,
    customerName: normalized.customerName,
    amount: grandTotal,
    gstAmount,
    balanceDue,
    status: normalized.status,
    dueDate: normalized.dueDate ?? undefined,
    source: 'pipeline',
    editPath: `/sales/${normalized.kind}/${normalized.id}/edit`,
  };
}

async function taxInvoiceRows(vouchers: Voucher[], ledgerMap: Map<string, string>): Promise<SalesDocumentRow[]> {
  const sales = vouchers.filter((v) => v.type === 'SALES' && (v.status ?? 'ACTIVE') !== 'CANCELLED');
  return sales
    .map((v) => {
      const party = partyFromVoucher(v, ledgerMap);
      const docDate = normalizeToYmd(v.date);
      return {
        id: v.id,
        kind: 'tax-invoices' as const,
        number: v.number,
        date: docDate,
        customerId: party.id,
        customerName: party.name,
        amount: voucherGrandTotal(v),
        gstAmount: voucherGstTotal(v),
        balanceDue: salesInvoiceBalanceDue(v, vouchers),
        status: mapPaymentToSalesStatus(v, vouchers),
        dueDate: parseDueDateToken(v.narration) ?? docDate,
        source: 'voucher' as const,
        voucherId: v.id,
        editPath: `/sales/invoices/${v.id}`,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
}

async function creditRows(vouchers: Voucher[], ledgerMap: Map<string, string>): Promise<SalesDocumentRow[]> {
  return vouchers
    .filter((v) => v.type === 'SALES_RETURN')
    .map((v) => {
      const party = partyFromVoucher(v, ledgerMap);
      return {
        id: v.id,
        kind: 'credit-adjustments' as const,
        number: v.number,
        date: normalizeToYmd(v.date),
        customerId: party.id,
        customerName: party.name,
        amount: voucherGrandTotal(v),
        status: (v.status ?? 'ACTIVE') === 'CANCELLED' ? ('CANCELLED' as const) : ('APPROVED' as const),
        source: 'voucher' as const,
        voucherId: v.id,
        editPath: `/vouchers/sales-return`,
      };
    });
}

async function collectionRows(vouchers: Voucher[], ledgerMap: Map<string, string>): Promise<SalesDocumentRow[]> {
  return vouchers
    .filter((v) => v.type === 'RECEIPT')
    .map((v) => {
      const party = partyFromVoucher(v, ledgerMap);
      const amount = voucherGrandTotal(v);
      return {
        id: v.id,
        kind: 'collections' as const,
        number: v.number,
        date: normalizeToYmd(v.date),
        customerId: party.id,
        customerName: party.name,
        amount,
        status: (v.status ?? 'ACTIVE') === 'CANCELLED' ? ('CANCELLED' as const) : ('PAID' as const),
        source: 'voucher' as const,
        voucherId: v.id,
        editPath: `/sales/collections/${v.id}/edit`,
      };
    });
}

export const salesDocumentService = {
  async listByKind(kind: SalesDocKind): Promise<SalesDocumentRow[]> {
    const [vouchers, ledgers, pipeline] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: false }),
      salesPipelineService.list(kind),
    ]);
    const ledgerMap = new Map(ledgers.map((l) => [l.id, l.name]));

    switch (kind) {
      case 'tax-invoices':
        return taxInvoiceRows(vouchers, ledgerMap);
      case 'credit-adjustments':
        return creditRows(vouchers, ledgerMap);
      case 'collections':
        return collectionRows(vouchers, ledgerMap);
      default:
        return pipeline.filter((p) => p.kind === kind).map(pipelineToRow);
    }
  },

  async bulkDeletePipeline(ids: string[]): Promise<void> {
    await salesPipelineService.remove(ids);
  },
};
