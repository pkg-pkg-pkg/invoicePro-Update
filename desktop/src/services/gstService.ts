import api from './api';

const isOfflineRuntime = () => {
  try {
    if ((window as any).__TAURI__ != null) return true;
    if ((window as any).__TAURI_INTERNALS__ != null) return true;
    if ((window as any).__TAURI_IPC__ != null) return true;
    if ((window as any).__TAURI_METADATA__ != null) return true;
    if ((navigator as any)?.userAgent && String((navigator as any).userAgent).toLowerCase().includes('tauri')) return true;
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
}

type StoredInvoice = {
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

const INVOICE_STORAGE_KEY = 'pve_invoicepro_invoices';

const loadInvoices = (): StoredInvoice[] => {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredInvoice[]) : [];
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

export const gstService = {
  async getGSTR1(month: number, year: number): Promise<GSTR1Response> {
    if (isOfflineRuntime()) {
      const invoices = loadInvoices().filter((i) => {
        const d = i.date ? new Date(i.date) : null;
        return d != null && d.getFullYear() === year && d.getMonth() + 1 === month;
      });

      const b2b: any[] = [];
      const b2c: any[] = [];
      for (const inv of invoices) {
        const { taxable, igst, cgst, sgst, tax } = sumTaxes(inv);
        const row = {
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

      return {
        period: { month, year },
        b2b,
        b2c,
        hsnSummary: makeHsnSummary(invoices),
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
      return {
        period: { month, year },
        b2b: [],
        hsnSummary: [],
        summary: {
          totalInvoices: 0,
          totalTaxableValue: 0,
          totalITC: 0,
          totalIGST: 0,
          totalCGST: 0,
          totalSGST: 0,
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
      const invoices = loadInvoices().filter((i) => {
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
      return {
        year,
        monthlyData: [],
        annualSummary: {
          totalSales: 0,
          totalPurchases: 0,
          totalSalesTax: 0,
          totalPurchaseTax: 0,
          netTaxPayable: 0,
        },
      };
    }
    const response = await api.get<GSTR9Response>('/gst/gstr9', {
      params: { year },
    });
    return response.data;
  },

  async exportGSTR1(month: number, year: number, gstin?: string): Promise<Blob> {
    if (isOfflineRuntime()) {
      const payload = { month, year, gstin, offline: true };
      return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    }
    const response = await api.get('/gst/gstr1/export', {
      params: { month, year, gstin },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportGSTR2(month: number, year: number, gstin?: string): Promise<Blob> {
    if (isOfflineRuntime()) {
      const payload = { month, year, gstin, offline: true };
      return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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
      const invoices = loadInvoices().filter((i) => {
        const d = i.date ? new Date(i.date) : null;
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
      return {
        fromDate: fromDate ?? '',
        toDate: toDate ?? '',
        hsnSummary: makeHsnSummary(invoices),
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

