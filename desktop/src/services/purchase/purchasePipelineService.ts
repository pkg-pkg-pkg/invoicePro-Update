import type { PurchaseDocKind, PurchasePipelineDocument } from '../../types/purchaseDocuments';
import type { SalesDocumentStatus } from '../../types/salesDocuments';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from '../masters/storageHelpers';
import { calcSalesDocumentTotals, generatePipelineNumber } from '../sales/salesPipelineCalc';

const STORAGE_KEY = 'pve_purchase_pipeline';

function normalizePipelineDoc(raw: PurchasePipelineDocument): PurchasePipelineDocument {
  const amount = Number(raw.grandTotal ?? raw.amount ?? 0);
  return {
    ...raw,
    lines: Array.isArray(raw.lines) ? raw.lines : [],
    header: raw.header ?? {},
    amount,
    grandTotal: Number(raw.grandTotal ?? raw.amount ?? 0),
  };
}

export const purchasePipelineService = {
  async list(kind?: PurchaseDocKind): Promise<PurchasePipelineDocument[]> {
    const rows = (await readList<PurchasePipelineDocument>(STORAGE_KEY)).map(normalizePipelineDoc);
    return rows
      .filter((r) => !kind || r.kind === kind)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getById(id: string): Promise<PurchasePipelineDocument | null> {
    const rows = await readList<PurchasePipelineDocument>(STORAGE_KEY);
    const found = rows.find((r) => r.id === id);
    return found ? normalizePipelineDoc(found) : null;
  },

  async nextNumber(kind: PurchaseDocKind): Promise<string> {
    const rows = await this.list(kind);
    return generatePipelineNumber(kind, rows.length);
  },

  async create(payload: Partial<PurchasePipelineDocument>): Promise<PurchasePipelineDocument> {
    const rows = await readList<PurchasePipelineDocument>(STORAGE_KEY);
    const kind = payload.kind as PurchaseDocKind;
    if (!kind) throw new Error('Document kind is required');

    const vendorName = sanitizeString(payload.vendorName ?? null);
    if (!vendorName) throw new Error('Vendor name is required');

    const lines = payload.lines ?? [];
    const totals = calcSalesDocumentTotals(lines, {
      freight: payload.header?.freightCharges,
      roundOff: payload.header?.roundOff,
      placeOfSupply: payload.header?.placeOfSupply ?? undefined,
    });

    const number =
      sanitizeString(payload.number ?? null) ||
      generatePipelineNumber(kind, rows.filter((r) => r.kind === kind).length);

    const now = nowIso();
    const row: PurchasePipelineDocument = normalizePipelineDoc({
      id: payload.id ?? generateId('pdoc'),
      kind,
      number,
      date: payload.date ?? now.slice(0, 10),
      vendorId: sanitizeString(payload.vendorId ?? null),
      vendorName,
      amount: Number(payload.grandTotal ?? totals.grandTotal ?? payload.amount ?? 0),
      status: (payload.status ?? 'DRAFT') as SalesDocumentStatus,
      dueDate: payload.dueDate ?? null,
      notes: sanitizeString(payload.notes ?? null),
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

  async update(id: string, patch: Partial<PurchasePipelineDocument>): Promise<PurchasePipelineDocument> {
    const rows = await readList<PurchasePipelineDocument>(STORAGE_KEY);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Document not found');
    const current = normalizePipelineDoc(rows[idx]);
    const lines = patch.lines ?? current.lines;
    const header = { ...current.header, ...(patch.header ?? {}) };
    const totals = calcSalesDocumentTotals(lines, {
      freight: header.freightCharges,
      roundOff: header.roundOff,
      placeOfSupply: header.placeOfSupply ?? undefined,
    });
    const updated: PurchasePipelineDocument = normalizePipelineDoc({
      ...current,
      ...patch,
      id: current.id,
      kind: current.kind,
      vendorName: sanitizeString(patch.vendorName ?? current.vendorName) ?? current.vendorName,
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
    const rows = await readList<PurchasePipelineDocument>(STORAGE_KEY);
    await writeList(
      STORAGE_KEY,
      rows.filter((r) => !set.has(r.id))
    );
  },
};
