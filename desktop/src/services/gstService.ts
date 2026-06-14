import api from './api';
import { voucherService } from './vouchers/voucherService';
import { ledgerAccountService } from './masters/ledgerAccountService';
import { inventoryItemService } from './masters/inventoryItemService';

const isOfflineRuntime = () => {
  try {
    const ua = String((navigator as any)?.userAgent || '').toLowerCase();
    if (ua.includes('electron')) return true;
    if ((window as any)?.process?.type === 'renderer') return true;
    if ((window as any).__TAURI__ != null) return true;
    if ((window as any).__TAURI_INTERNALS__ != null) return true;
    if ((window as any).__TAURI_IPC__ != null) return true;
    if ((window as any).__TAURI_METADATA__ != null) return true;
    if (ua.includes('tauri')) return true;
    if (window.location.hostname === 'tauri.localhost') return true;
    const p = window.location.protocol;
    return p === 'tauri:' || p === 'file:';
  } catch {
    return false;
  }
};

export interface GSTR1Response {
  period: { month: number; year: number };
  b2b: any[];
  b2c: any[];
  hsnSummary: any[];
  nilRated?: any[];
  exempted?: any[];
  exportSales?: any[];
  taxLiability?: {
    igst: number;
    cgst: number;
    sgst: number;
    total: number;
  };
  summary: {
    totalB2BInvoices: number;
    totalB2CInvoices: number;
    totalTaxableValue: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
  };
}

export interface GSTR2Response {
  period: { month: number; year: number };
  b2b: any[];
  hsnSummary: any[];
  summary: {
    totalInvoices: number;
    totalTaxableValue: number;
    totalITC: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
  };
}

export interface GSTR3BResponse {
  period: { month: number; year: number };
  outwardSupplies: {
    totalTaxableValue: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
    totalTax: number;
  };
  inwardSupplies: {
    totalTaxableValue: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
    totalITC: number;
  };
  taxLiability: {
    igst: number;
    cgst: number;
    sgst: number;
    total: number;
  };
  summary: {
    netTaxPayable: number;
    itcAvailable: number;
    itcUtilized: number;
  };
}

export interface GSTR9Response {
  year: number;
  monthlyData: Array<{
    month: number;
    sales: { count: number; total: number; tax: number };
    purchases: { count: number; total: number; tax: number };
  }>;
  annualSummary: {
    totalSales: number;
    totalPurchases: number;
    totalSalesTax: number;
    totalPurchaseTax: number;
    netTaxPayable: number;
  };
}

export interface HSNSummaryResponse {
  fromDate: string;
  toDate: string;
  hsnSummary: Array<{
    hsnCode: string;
    description: string;
    quantity: number;
    uqc: string;
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  }>;
  b2bHsnSummary?: Array<{
    hsnCode: string;
    description: string;
    quantity: number;
    uqc: string;
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  }>;
  b2cHsnSummary?: Array<{
    hsnCode: string;
    description: string;
    quantity: number;
    uqc: string;
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  }>;
}

type StoredInvoice = {
  voucherId?: string;
  invoiceNumber?: string;
  date?: string;
  supplyType?: 'INTRA' | 'INTER';
  billTo?: { name?: string; gstin?: string };
  items?: Array<{
    hsn?: string;
    qty?: number;
    rate?: number;
    gstRate?: number;
    taxableAmount?: number;
    gstAmount?: number;
  }>;
};

type StoredPurchaseInvoice = {
  voucherId?: string;
  invoiceNumber?: string;
  date?: string;
  supplyType?: 'INTRA' | 'INTER';
  supplier?: { name?: string; gstin?: string };
  items?: Array<{
    hsn?: string;
    qty?: number;
    rate?: number;
    gstRate?: number;
    taxableAmount?: number;
    gstAmount?: number;
  }>;
};

const INVOICE_STORAGE_KEY = 'pve_invoicepro_invoices';

const loadLegacyInvoices = (): StoredInvoice[] => {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredInvoice[]) : [];
  } catch {
    return [];
  }
};

const loadInvoices = async (): Promise<StoredInvoice[]> => {
  try {
    const vouchers = await voucherService.list();
    const sales = vouchers.filter((v) => v.type === 'SALES' && v.status === 'ACTIVE');
    if (!sales.length) return loadLegacyInvoices();

    const customerLedgerIds = Array.from(
      new Set(
        sales
          .map((v) => v.lines.find((ln) => Number(ln.debit || 0) > 0)?.ledgerId)
          .filter((x): x is string => Boolean(x))
      )
    );
    const itemIds = Array.from(
      new Set(
        sales
          .flatMap((v) => v.lines)
          .map((ln) => ln.itemId)
          .filter((x): x is string => Boolean(x))
      )
    );

    const [ledgerPairs, itemPairs] = await Promise.all([
      Promise.all(customerLedgerIds.map(async (id) => [id, await ledgerAccountService.getById(id)] as const)),
      Promise.all(itemIds.map(async (id) => [id, await inventoryItemService.getById(id)] as const)),
    ]);
    const ledgerMap = new Map(ledgerPairs);
    const itemMap = new Map(itemPairs);
    const gstLedgerIds = new Set(['led-cgst-output', 'led-sgst-output', 'led-igst-output']);

    return sales.map((voucher) => {
      const customerLine = voucher.lines.find((ln) => Number(ln.debit || 0) > 0);
      const customer = customerLine ? ledgerMap.get(customerLine.ledgerId) : null;
      const itemLines = voucher.lines.filter((ln) => Boolean(ln.itemId) && Number(ln.credit || 0) > 0);
      const taxableTotal = itemLines.reduce((sum, ln) => sum + Number(ln.credit || 0), 0);
      const taxTotal = voucher.lines.reduce((sum, ln) => {
        const explicit = Number((ln.cgstAmount || 0) + (ln.sgstAmount || 0) + (ln.igstAmount || 0));
        if (explicit > 0) return sum + explicit;
        if (ln.taxType || gstLedgerIds.has(String(ln.ledgerId || ''))) return sum + Number(ln.credit || 0);
        return sum;
      }, 0);
      const igstTotal = voucher.lines.reduce(
        (sum, ln) =>
          sum +
          (Number(ln.igstAmount || 0) +
            (String(ln.ledgerId || '') === 'led-igst-output' ? Number(ln.credit || 0) : 0)),
        0
      );
      const cgstTotal = voucher.lines.reduce(
        (sum, ln) =>
          sum +
          (Number(ln.cgstAmount || 0) +
            (String(ln.ledgerId || '') === 'led-cgst-output' ? Number(ln.credit || 0) : 0)),
        0
      );
      const sgstTotal = voucher.lines.reduce(
        (sum, ln) =>
          sum +
          (Number(ln.sgstAmount || 0) +
            (String(ln.ledgerId || '') === 'led-sgst-output' ? Number(ln.credit || 0) : 0)),
        0
      );
      const supplyType: 'INTRA' | 'INTER' = igstTotal > 0 ? 'INTER' : 'INTRA';

      const items = itemLines.map((ln) => {
        const taxable = Number(ln.credit || 0);
        const share = taxableTotal > 0 ? taxable / taxableTotal : 0;
        const allocatedTax = Number((taxTotal * share).toFixed(2));
        const item = ln.itemId ? itemMap.get(ln.itemId) : null;
        const qty = Number(ln.quantity || 0);
        const rate = qty > 0 ? Number((taxable / qty).toFixed(2)) : taxable;
        return {
          hsn: String(item?.hsnCode || '').trim(),
          qty,
          rate,
          gstRate: Number(item?.gstRate || 0),
          taxableAmount: taxable,
          gstAmount: allocatedTax,
        };
      });

      return {
        voucherId: voucher.id,
        invoiceNumber: voucher.number,
        date: voucher.date,
        supplyType,
        billTo: {
          name: String(customer?.name || ''),
          gstin: String(customer?.gstDetails?.gstin || ''),
        },
        items,
      } as StoredInvoice;
    });
  } catch {
    return loadLegacyInvoices();
  }
};

const loadPurchaseInvoices = async (): Promise<StoredPurchaseInvoice[]> => {
  try {
    const vouchers = await voucherService.list();
    const purchases = vouchers.filter((v) => v.type === 'PURCHASE' && v.status === 'ACTIVE');
    if (!purchases.length) return [];

    const supplierLedgerIds = Array.from(
      new Set(
        purchases
          .map((v) => v.lines.find((ln) => Number(ln.credit || 0) > 0)?.ledgerId)
          .filter((x): x is string => Boolean(x))
      )
    );
    const itemIds = Array.from(
      new Set(
        purchases
          .flatMap((v) => v.lines)
          .map((ln) => ln.itemId)
          .filter((x): x is string => Boolean(x))
      )
    );

    const [ledgerPairs, itemPairs] = await Promise.all([
      Promise.all(supplierLedgerIds.map(async (id) => [id, await ledgerAccountService.getById(id)] as const)),
      Promise.all(itemIds.map(async (id) => [id, await inventoryItemService.getById(id)] as const)),
    ]);
    const ledgerMap = new Map(ledgerPairs);
    const itemMap = new Map(itemPairs);
    const gstLedgerIds = new Set(['led-cgst-input', 'led-sgst-input', 'led-igst-input']);

    return purchases.map((voucher) => {
      const supplierLine = voucher.lines.find((ln) => Number(ln.credit || 0) > 0);
      const supplier = supplierLine ? ledgerMap.get(supplierLine.ledgerId) : null;
      const itemLines = voucher.lines.filter((ln) => Boolean(ln.itemId) && Number(ln.debit || 0) > 0);
      const taxableTotal = itemLines.reduce((sum, ln) => sum + Number(ln.debit || 0), 0);
      const taxTotal = voucher.lines.reduce((sum, ln) => {
        const explicit = Number((ln.cgstAmount || 0) + (ln.sgstAmount || 0) + (ln.igstAmount || 0));
        if (explicit > 0) return sum + explicit;
        if (ln.taxType || gstLedgerIds.has(String(ln.ledgerId || ''))) return sum + Number(ln.debit || 0);
        return sum;
      }, 0);
      const igstTotal = voucher.lines.reduce(
        (sum, ln) =>
          sum +
          (Number(ln.igstAmount || 0) + (String(ln.ledgerId || '') === 'led-igst-input' ? Number(ln.debit || 0) : 0)),
        0
      );
      const supplyType: 'INTRA' | 'INTER' = igstTotal > 0 ? 'INTER' : 'INTRA';

      const items = itemLines.map((ln) => {
        const taxable = Number(ln.debit || 0);
        const share = taxableTotal > 0 ? taxable / taxableTotal : 0;
        const allocatedTax = Number((taxTotal * share).toFixed(2));
        const item = ln.itemId ? itemMap.get(ln.itemId) : null;
        const qty = Number(ln.quantity || 0);
        const rate = qty > 0 ? Number((taxable / qty).toFixed(2)) : taxable;
        return {
          hsn: String(item?.hsnCode || '').trim(),
          qty,
          rate,
          gstRate: Number(item?.gstRate || 0),
          taxableAmount: taxable,
          gstAmount: allocatedTax,
        };
      });

      return {
        voucherId: voucher.id,
        invoiceNumber: voucher.number,
        date: voucher.date,
        supplyType,
        supplier: {
          name: String(supplier?.name || ''),
          gstin: String(supplier?.gstDetails?.gstin || ''),
        },
        items,
      } as StoredPurchaseInvoice;
    });
  } catch {
    return [];
  }
};

const sumTaxes = (inv: StoredInvoice) => {
  const items = Array.isArray(inv.items) ? inv.items : [];
  let taxable = 0;
  let tax = 0;
  let igst = 0;
  let cgst = 0;
  let sgst = 0;

  for (const it of items) {
    const tx = Number(it.taxableAmount ?? 0);
    const t = Number(it.gstAmount ?? 0);
    taxable += tx;
    tax += t;

    const intra = (inv.supplyType ?? 'INTRA') === 'INTRA';
    if (intra) {
      cgst += t / 2;
      sgst += t / 2;
    } else {
      igst += t;
    }
  }

  return { taxable, tax, igst, cgst, sgst };
};

const makeHsnSummary = (invoices: StoredInvoice[]) => {
  const map = new Map<string, { hsnCode: string; quantity: number; taxableValue: number; igst: number; cgst: number; sgst: number; totalTax: number }>();

  for (const inv of invoices) {
    const intra = (inv.supplyType ?? 'INTRA') === 'INTRA';
    const items = Array.isArray(inv.items) ? inv.items : [];
    for (const it of items) {
      const hsn = String(it.hsn ?? '').trim() || 'NA';
      const qty = Number(it.qty ?? 0);
      const taxable = Number(it.taxableAmount ?? 0);
      const tax = Number(it.gstAmount ?? 0);

      const existing = map.get(hsn) ?? { hsnCode: hsn, quantity: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0 };
      existing.quantity += qty;
      existing.taxableValue += taxable;
      existing.totalTax += tax;
      if (intra) {
        existing.cgst += tax / 2;
        existing.sgst += tax / 2;
      } else {
        existing.igst += tax;
      }
      map.set(hsn, existing);
    }
  }

  return Array.from(map.values()).map((x) => ({
    hsnCode: x.hsnCode,
    description: '',
    quantity: x.quantity,
    uqc: '',
    rate: 0,
    taxableValue: x.taxableValue,
    igst: x.igst,
    cgst: x.cgst,
    sgst: x.sgst,
    totalTax: x.totalTax,
  }));
};

const makeHsnSummaryFromPurchase = (invoices: StoredPurchaseInvoice[]) =>
  makeHsnSummary(
    invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      supplyType: inv.supplyType,
      billTo: { name: inv.supplier?.name, gstin: inv.supplier?.gstin },
      items: inv.items,
    }))
  );

const buildSupplySegments = (invoices: StoredInvoice[]) => {
  const nilRated: any[] = [];
  const exempted: any[] = [];
  const exportSales: any[] = [];

  for (const inv of invoices) {
    const items = Array.isArray(inv.items) ? inv.items : [];
    for (const it of items) {
      const gstRate = Number(it.gstRate ?? 0);
      const taxable = Number(it.taxableAmount ?? 0);
      const tax = Number(it.gstAmount ?? 0);
      if (taxable <= 0) continue;
      const row = {
        invoiceNumber: inv.invoiceNumber ?? '',
        invoiceDate: inv.date ?? '',
        customerName: inv.billTo?.name ?? '',
        hsn: String(it.hsn ?? ''),
        taxableValue: taxable,
        gstRate,
      };
      if (gstRate === 0 && tax === 0) {
        exempted.push(row);
        if ((inv.supplyType ?? 'INTRA') === 'INTER') {
          exportSales.push({ ...row, supplyType: inv.supplyType });
        } else {
          nilRated.push(row);
        }
      }
    }
  }

  return { nilRated, exempted, exportSales };
};

export const gstService = {
  async getGSTR1(month: number, year: number): Promise<GSTR1Response> {
    if (isOfflineRuntime()) {
      const invoices = (await loadInvoices()).filter((i) => {
        const d = i.date ? new Date(i.date) : null;
        return d != null && d.getFullYear() === year && d.getMonth() + 1 === month;
      });

      const b2b: any[] = [];
      const b2c: any[] = [];
      for (const inv of invoices) {
        const { taxable, igst, cgst, sgst, tax } = sumTaxes(inv);
        const row = {
          voucherId: inv.voucherId ?? '',
          invoiceNumber: inv.invoiceNumber ?? '',
          invoiceDate: inv.date ?? '',
          customerName: inv.billTo?.name ?? '',
          customerGSTIN: inv.billTo?.gstin ?? '',
          taxableValue: taxable,
          igst,
          cgst,
          sgst,
          totalTax: tax,
        };
        if (String(inv.billTo?.gstin ?? '').trim()) b2b.push(row);
        else b2c.push(row);
      }

      const summaryTotals = invoices.reduce(
        (acc, inv) => {
          const { taxable, igst, cgst, sgst } = sumTaxes(inv);
          acc.totalTaxableValue += taxable;
          acc.totalIGST += igst;
          acc.totalCGST += cgst;
          acc.totalSGST += sgst;
          return acc;
        },
        { totalTaxableValue: 0, totalIGST: 0, totalCGST: 0, totalSGST: 0 }
      );

      const segments = buildSupplySegments(invoices);

      return {
        period: { month, year },
        b2b,
        b2c,
        hsnSummary: makeHsnSummary(invoices),
        nilRated: segments.nilRated,
        exempted: segments.exempted,
        exportSales: segments.exportSales,
        taxLiability: {
          igst: summaryTotals.totalIGST,
          cgst: summaryTotals.totalCGST,
          sgst: summaryTotals.totalSGST,
          total: summaryTotals.totalIGST + summaryTotals.totalCGST + summaryTotals.totalSGST,
        },
        summary: {
          totalB2BInvoices: b2b.length,
          totalB2CInvoices: b2c.length,
          totalTaxableValue: summaryTotals.totalTaxableValue,
          totalIGST: summaryTotals.totalIGST,
          totalCGST: summaryTotals.totalCGST,
          totalSGST: summaryTotals.totalSGST,
        },
      };
    }
    const response = await api.get<GSTR1Response>('/gst/gstr1', {
      params: { month, year },
    });
    return response.data;
  },

  async getGSTR2(month: number, year: number): Promise<GSTR2Response> {
    if (isOfflineRuntime()) {
      const purchases = (await loadPurchaseInvoices()).filter((i) => {
        const d = i.date ? new Date(i.date) : null;
        return d != null && d.getFullYear() === year && d.getMonth() + 1 === month;
      });

      const b2b = purchases
        .filter((inv) => String(inv.supplier?.gstin ?? '').trim())
        .map((inv) => {
          const agg = sumTaxes({
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            supplyType: inv.supplyType,
            billTo: { name: inv.supplier?.name, gstin: inv.supplier?.gstin },
            items: inv.items,
          });
          return {
            voucherId: inv.voucherId ?? '',
            supplierGSTIN: String(inv.supplier?.gstin || ''),
            supplierName: String(inv.supplier?.name || ''),
            invoiceNumber: String(inv.invoiceNumber || ''),
            invoiceDate: String(inv.date || ''),
            taxableValue: agg.taxable,
            igst: agg.igst,
            cgst: agg.cgst,
            sgst: agg.sgst,
            totalTax: agg.tax,
          };
        });

      const summary = purchases.reduce(
        (acc, inv) => {
          const agg = sumTaxes({
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            supplyType: inv.supplyType,
            billTo: { name: inv.supplier?.name, gstin: inv.supplier?.gstin },
            items: inv.items,
          });
          acc.totalTaxableValue += agg.taxable;
          acc.totalIGST += agg.igst;
          acc.totalCGST += agg.cgst;
          acc.totalSGST += agg.sgst;
          acc.totalITC += agg.tax;
          return acc;
        },
        { totalTaxableValue: 0, totalITC: 0, totalIGST: 0, totalCGST: 0, totalSGST: 0 }
      );

      return {
        period: { month, year },
        b2b,
        hsnSummary: makeHsnSummaryFromPurchase(purchases),
        summary: {
          totalInvoices: purchases.length,
          totalTaxableValue: summary.totalTaxableValue,
          totalITC: summary.totalITC,
          totalIGST: summary.totalIGST,
          totalCGST: summary.totalCGST,
          totalSGST: summary.totalSGST,
        },
      };
    }
    const response = await api.get<GSTR2Response>('/gst/gstr2', {
      params: { month, year },
    });
    return response.data;
  },

  async getGSTR3B(month: number, year: number): Promise<GSTR3BResponse> {
    if (isOfflineRuntime()) {
      const invoices = (await loadInvoices()).filter((i) => {
        const d = i.date ? new Date(i.date) : null;
        return d != null && d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      const totals = invoices.reduce(
        (acc, inv) => {
          const { taxable, igst, cgst, sgst, tax } = sumTaxes(inv);
          acc.taxable += taxable;
          acc.igst += igst;
          acc.cgst += cgst;
          acc.sgst += sgst;
          acc.tax += tax;
          return acc;
        },
        { taxable: 0, igst: 0, cgst: 0, sgst: 0, tax: 0 }
      );
      return {
        period: { month, year },
        outwardSupplies: {
          totalTaxableValue: totals.taxable,
          totalIGST: totals.igst,
          totalCGST: totals.cgst,
          totalSGST: totals.sgst,
          totalTax: totals.tax,
        },
        inwardSupplies: {
          totalTaxableValue: 0,
          totalIGST: 0,
          totalCGST: 0,
          totalSGST: 0,
          totalITC: 0,
        },
        taxLiability: {
          igst: totals.igst,
          cgst: totals.cgst,
          sgst: totals.sgst,
          total: totals.tax,
        },
        summary: {
          netTaxPayable: totals.tax,
          itcAvailable: 0,
          itcUtilized: 0,
        },
      };
    }
    const response = await api.get<GSTR3BResponse>('/gst/gstr3b', {
      params: { month, year },
    });
    return response.data;
  },

  async getGSTR9(year: number): Promise<GSTR9Response> {
    if (isOfflineRuntime()) {
      const [salesAll, purchaseAll] = await Promise.all([loadInvoices(), loadPurchaseInvoices()]);
      const monthlyData = Array.from({ length: 12 }, (_, idx) => {
        const month = ((idx + 3) % 12) + 1; // Apr..Mar
        const calendarYear = month >= 4 ? year - 1 : year;
        const sales = salesAll.filter((i) => {
          const d = i.date ? new Date(i.date) : null;
          return d && d.getFullYear() === calendarYear && d.getMonth() + 1 === month;
        });
        const purchases = purchaseAll.filter((i) => {
          const d = i.date ? new Date(i.date) : null;
          return d && d.getFullYear() === calendarYear && d.getMonth() + 1 === month;
        });
        const salesAgg = sales.reduce(
          (acc, inv) => {
            const s = sumTaxes(inv);
            acc.count += 1;
            acc.total += s.taxable;
            acc.tax += s.tax;
            return acc;
          },
          { count: 0, total: 0, tax: 0 }
        );
        const purchaseAgg = purchases.reduce(
          (acc, inv) => {
            const s = sumTaxes({
              invoiceNumber: inv.invoiceNumber,
              date: inv.date,
              supplyType: inv.supplyType,
              billTo: { name: inv.supplier?.name, gstin: inv.supplier?.gstin },
              items: inv.items,
            });
            acc.count += 1;
            acc.total += s.taxable;
            acc.tax += s.tax;
            return acc;
          },
          { count: 0, total: 0, tax: 0 }
        );
        return { month, sales: salesAgg, purchases: purchaseAgg };
      });
      const annualSummary = monthlyData.reduce(
        (acc, m) => {
          acc.totalSales += m.sales.total;
          acc.totalPurchases += m.purchases.total;
          acc.totalSalesTax += m.sales.tax;
          acc.totalPurchaseTax += m.purchases.tax;
          return acc;
        },
        { totalSales: 0, totalPurchases: 0, totalSalesTax: 0, totalPurchaseTax: 0, netTaxPayable: 0 }
      );
      annualSummary.netTaxPayable = Number((annualSummary.totalSalesTax - annualSummary.totalPurchaseTax).toFixed(2));
      return { year, monthlyData, annualSummary };
    }
    const response = await api.get<GSTR9Response>('/gst/gstr9', {
      params: { year },
    });
    return response.data;
  },

  async exportGSTR1(month: number, year: number, gstin?: string): Promise<Blob> {
    if (isOfflineRuntime()) {
      const payload = await this.getGSTR1(month, year);
      return new Blob([JSON.stringify({ ...payload, gstin, exportedAt: new Date().toISOString() }, null, 2)], {
        type: 'application/json',
      });
    }
    const response = await api.get('/gst/gstr1/export', {
      params: { month, year, gstin },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportGSTR2(month: number, year: number, gstin?: string): Promise<Blob> {
    if (isOfflineRuntime()) {
      const payload = await this.getGSTR2(month, year);
      return new Blob([JSON.stringify({ ...payload, gstin, exportedAt: new Date().toISOString() }, null, 2)], {
        type: 'application/json',
      });
    }
    const response = await api.get('/gst/gstr2/export', {
      params: { month, year, gstin },
      responseType: 'blob',
    });
    return response.data;
  },

  async getHSNSummary(fromDate?: string, toDate?: string): Promise<HSNSummaryResponse> {
    if (isOfflineRuntime()) {
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      const invoices = (await loadInvoices()).filter((i) => {
        const d = i.date ? new Date(i.date) : null;
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
      const b2bInvoices = invoices.filter((inv) => String(inv.billTo?.gstin ?? '').trim());
      const b2cInvoices = invoices.filter((inv) => !String(inv.billTo?.gstin ?? '').trim());
      return {
        fromDate: fromDate ?? '',
        toDate: toDate ?? '',
        hsnSummary: makeHsnSummary(invoices),
        b2bHsnSummary: makeHsnSummary(b2bInvoices),
        b2cHsnSummary: makeHsnSummary(b2cInvoices),
      };
    }
    const response = await api.get<HSNSummaryResponse>('/gst/hsn-summary', {
      params: { fromDate, toDate },
    });
    return response.data;
  },

  async generateEwayBill(invoiceId: string): Promise<{ ewayBillNumber: string; invoiceNumber: string }> {
    if (isOfflineRuntime()) {
      return { ewayBillNumber: 'OFFLINE', invoiceNumber: String(invoiceId) };
    }
    const response = await api.post('/gst/eway-bill', { invoiceId });
    return response.data;
  },
};

