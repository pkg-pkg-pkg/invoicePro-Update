import api from './api';
import type { Voucher } from '../types/vouchers';
import { voucherService } from './vouchers/voucherService';
import { voucherGrandTotal } from './voucherPrintBuilder';
import { ledgerAccountService } from './masters/ledgerAccountService';
import { inventoryItemService } from './masters/inventoryItemService';

type LedgerLite = { id: string; name?: string };
type ItemLite = { id: string; name?: string };

const isOfflineRuntime = () => {
  try {
    const ua = String((navigator as any)?.userAgent || '').toLowerCase();
    if (ua.includes('electron')) return true;
    if ((window as any)?.process?.type === 'renderer') return true;
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

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const loadOfflineBaseData = async () => {
  const [vouchers, ledgers, items] = await Promise.all([
    voucherService.list(),
    ledgerAccountService.list({ includeInactive: true }),
    inventoryItemService.list({ includeInactive: true }),
  ]);
  return {
    vouchers,
    ledgers: ledgers.map((l) => ({ id: String(l.id), name: String(l.name || l.id) })),
    items: items.map((i) => ({ id: String(i.id), name: String(i.name || i.id) })),
  };
};

const inDateRange = (iso: string, from?: string, to?: string) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (from) {
    const f = new Date(from).getTime();
    if (Number.isFinite(f) && t < f) return false;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59`).getTime();
    if (Number.isFinite(d) && t > d) return false;
  }
  return true;
};

const offlineSalesRows = async (filters: { fromDate?: string; toDate?: string }) => {
  const { vouchers, ledgers, items } = await loadOfflineBaseData();
  const ledgerName = new Map(ledgers.map((l) => [String(l.id), String(l.name || l.id)]));
  const itemName = new Map(items.map((i) => [String(i.id), String(i.name || i.id)]));
  const sales = vouchers.filter((v) => v.type === 'SALES' && v.status === 'ACTIVE' && inDateRange(v.date, filters.fromDate, filters.toDate));
  return sales.map((v) => {
    const customerLine = v.lines.find((l) => Number(l.debit || 0) > 0);
    const customerName = customerLine ? ledgerName.get(String(customerLine.ledgerId)) || String(customerLine.ledgerId) : '—';
    const itemLines = v.lines.filter((l) => l.itemId && Number(l.quantity || 0) > 0);
    const subtotal = Number(itemLines.reduce((s, l) => s + Number(l.credit || l.debit || 0), 0).toFixed(2));
    const cgst = Number(
      v.lines
        .filter((l) => String(l.ledgerId || '').toLowerCase().includes('cgst'))
        .reduce((s, l) => s + Number(l.credit || l.debit || 0), 0)
        .toFixed(2)
    );
    const sgst = Number(
      v.lines
        .filter((l) => String(l.ledgerId || '').toLowerCase().includes('sgst'))
        .reduce((s, l) => s + Number(l.credit || l.debit || 0), 0)
        .toFixed(2)
    );
    const igst = Number(
      v.lines
        .filter((l) => String(l.ledgerId || '').toLowerCase().includes('igst'))
        .reduce((s, l) => s + Number(l.credit || l.debit || 0), 0)
        .toFixed(2)
    );
    const tax = Number((cgst + sgst + igst).toFixed(2));
    const grand = Number((subtotal + tax).toFixed(2));
    return {
      id: v.id,
      date: v.date,
      invoiceNumber: v.number,
      customerName,
      customerLedgerId: customerLine?.ledgerId || '',
      products: itemLines.map((l) => itemName.get(String(l.itemId)) || String(l.itemId)).join(', '),
      quantity: Number(itemLines.reduce((s, l) => s + Number(l.quantity || 0), 0).toFixed(2)),
      subtotal,
      cgst,
      sgst,
      igst,
      totalTax: tax,
      grandTotal: grand,
      paid: 0,
      balance: grand,
      paymentStatus: 'PENDING',
      itemLines,
    };
  });
};

const offlinePurchaseRows = async (filters: { fromDate?: string; toDate?: string }) => {
  const { vouchers, ledgers, items } = await loadOfflineBaseData();
  const ledgerName = new Map(ledgers.map((l) => [String(l.id), String(l.name || l.id)]));
  const itemName = new Map(items.map((i) => [String(i.id), String(i.name || i.id)]));
  const purchases = vouchers.filter((v) => v.type === 'PURCHASE' && v.status === 'ACTIVE' && inDateRange(v.date, filters.fromDate, filters.toDate));
  return purchases.map((v) => {
    const supplierLine = v.lines.find((l) => Number(l.credit || 0) > 0 && !String(l.ledgerId || '').toLowerCase().includes('round'));
    const supplierName = supplierLine ? ledgerName.get(String(supplierLine.ledgerId)) || String(supplierLine.ledgerId) : '—';
    const itemLines = v.lines.filter((l) => l.itemId && Number(l.quantity || 0) > 0);
    const subtotal = Number(itemLines.reduce((s, l) => s + Number(l.debit || l.credit || 0), 0).toFixed(2));
    const cgst = Number(
      v.lines
        .filter((l) => String(l.ledgerId || '').toLowerCase().includes('cgst'))
        .reduce((s, l) => s + Number(l.debit || l.credit || 0), 0)
        .toFixed(2)
    );
    const sgst = Number(
      v.lines
        .filter((l) => String(l.ledgerId || '').toLowerCase().includes('sgst'))
        .reduce((s, l) => s + Number(l.debit || l.credit || 0), 0)
        .toFixed(2)
    );
    const igst = Number(
      v.lines
        .filter((l) => String(l.ledgerId || '').toLowerCase().includes('igst'))
        .reduce((s, l) => s + Number(l.debit || l.credit || 0), 0)
        .toFixed(2)
    );
    const tax = Number((cgst + sgst + igst).toFixed(2));
    const grand = Number((subtotal + tax).toFixed(2));
    return {
      id: v.id,
      date: v.date,
      voucherNumber: v.number,
      supplierName,
      supplierLedgerId: supplierLine?.ledgerId || '',
      products: itemLines.map((l) => itemName.get(String(l.itemId)) || String(l.itemId)).join(', '),
      quantity: Number(itemLines.reduce((s, l) => s + Number(l.quantity || 0), 0).toFixed(2)),
      subtotal,
      cgst,
      sgst,
      igst,
      totalTax: tax,
      grandTotal: grand,
      paid: 0,
      balance: grand,
      paymentStatus: 'PENDING',
    };
  });
};

// ==================== SALES REPORTS ====================

export interface SalesRegisterFilters {
  fromDate?: string;
  toDate?: string;
  customerId?: string;
  productId?: string;
  categoryId?: string;
  paymentStatus?: string;
  invoiceStatus?: string;
  paymentMode?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SalesRegisterResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalInvoices: number;
    totalAmount: number;
    totalPaid: number;
    totalBalance: number;
    totalTax: number;
  };
}

export interface SalesSummaryFilters {
  fromDate?: string;
  toDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
}

export interface SalesByCustomerFilters {
  fromDate?: string;
  toDate?: string;
  topN?: number;
}

export interface SalesByProductFilters {
  fromDate?: string;
  toDate?: string;
  categoryId?: string;
}

// ==================== PURCHASE REPORTS ====================

export interface PurchaseRegisterFilters {
  fromDate?: string;
  toDate?: string;
  supplierId?: string;
  productId?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
}

// ==================== STOCK REPORTS ====================

export interface CurrentStockFilters {
  categoryId?: string;
  showOnly?: 'outOfStock' | 'lowStock' | 'inStock';
  minStock?: number;
  maxStock?: number;
}

export interface StockMovementFilters {
  fromDate?: string;
  toDate?: string;
  productId?: string;
  type?: string;
  page?: number;
  limit?: number;
}

// ==================== FINANCIAL REPORTS ====================

export interface DayBookFilters {
  date?: string;
}

export interface ProfitLossFilters {
  fromDate?: string;
  toDate?: string;
}

// ==================== PARTY REPORTS ====================

// ==================== PAYMENT REPORTS ====================

export interface PaymentReceivedFilters {
  fromDate?: string;
  toDate?: string;
  customerId?: string;
  paymentMode?: string;
  page?: number;
  limit?: number;
}

export interface PaymentMadeFilters {
  fromDate?: string;
  toDate?: string;
  supplierId?: string;
  paymentMode?: string;
  page?: number;
  limit?: number;
}

export const reportService = {
  // Sales Reports
  getSalesRegister: async (filters: SalesRegisterFilters = {}): Promise<SalesRegisterResponse> => {
    if (isOfflineRuntime()) {
      const rows = await offlineSalesRows(filters);
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 50);
      const start = (page - 1) * limit;
      const data = rows.slice(start, start + limit);
      const totalAmount = Number(rows.reduce((s, r) => s + Number(r.grandTotal || 0), 0).toFixed(2));
      const totalTax = Number(rows.reduce((s, r) => s + Number(r.totalTax || 0), 0).toFixed(2));
      return {
        data,
        pagination: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
        summary: {
          totalInvoices: rows.length,
          totalAmount,
          totalPaid: 0,
          totalBalance: totalAmount,
          totalTax,
        },
      };
    }
    const response = await api.get('/reports/sales/register', { params: filters });
    return response.data;
  },

  getSalesSummary: async (filters: SalesSummaryFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      const rows = await offlineSalesRows(filters);
      const byPeriod = new Map<string, { invoices: number; quantity: number; taxableAmount: number; tax: number; total: number }>();
      rows.forEach((r) => {
        const period = String(r.date || '').slice(0, 10);
        const current = byPeriod.get(period) || { invoices: 0, quantity: 0, taxableAmount: 0, tax: 0, total: 0 };
        current.invoices += 1;
        current.quantity += Number(r.quantity || 0);
        current.taxableAmount += Number(r.subtotal || 0);
        current.tax += Number(r.totalTax || 0);
        current.total += Number(r.grandTotal || 0);
        byPeriod.set(period, current);
      });
      const data = Array.from(byPeriod.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, v]) => ({
          period,
          invoices: v.invoices,
          quantity: Number(v.quantity.toFixed(2)),
          taxableAmount: Number(v.taxableAmount.toFixed(2)),
          tax: Number(v.tax.toFixed(2)),
          total: Number(v.total.toFixed(2)),
        }));
      return { data, summary: { periods: data.length } };
    }
    const response = await api.get('/reports/sales/summary', { params: filters });
    return response.data;
  },

  getSalesByCustomer: async (filters: SalesByCustomerFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      const rows = await offlineSalesRows(filters);
      const byCustomer = new Map<string, { customerName: string; invoices: number; quantity: number; totalAmount: number; paid: number; balance: number; lastPurchaseDate: string }>();
      rows.forEach((r) => {
        const key = String(r.customerLedgerId || r.customerName || 'unknown');
        const current = byCustomer.get(key) || {
          customerName: r.customerName || 'Unknown',
          invoices: 0,
          quantity: 0,
          totalAmount: 0,
          paid: 0,
          balance: 0,
          lastPurchaseDate: r.date,
        };
        current.invoices += 1;
        current.quantity += Number(r.quantity || 0);
        current.totalAmount += Number(r.grandTotal || 0);
        current.balance += Number(r.grandTotal || 0);
        if (new Date(r.date).getTime() > new Date(current.lastPurchaseDate).getTime()) current.lastPurchaseDate = r.date;
        byCustomer.set(key, current);
      });
      const data = Array.from(byCustomer.values()).map((v) => ({
        ...v,
        quantity: Number(v.quantity.toFixed(2)),
        totalAmount: Number(v.totalAmount.toFixed(2)),
        paid: Number(v.paid.toFixed(2)),
        balance: Number(v.balance.toFixed(2)),
      }));
      return { data, summary: { customers: data.length } };
    }
    const response = await api.get('/reports/sales/by-customer', { params: filters });
    return response.data;
  },

  getSalesByProduct: async (filters: SalesByProductFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      const rows = await offlineSalesRows(filters);
      const byProduct = new Map<string, { productName: string; category: string; quantity: number; amount: number; averageRate: number }>();
      rows.forEach((r) => {
        r.itemLines.forEach((line: any) => {
          const id = String(line.itemId || 'unknown');
          const current = byProduct.get(id) || { productName: id, category: '—', quantity: 0, amount: 0, averageRate: 0 };
          const qty = Number(line.quantity || 0);
          const amt = Number(line.credit || line.debit || 0);
          current.quantity += qty;
          current.amount += amt;
          current.averageRate = current.quantity > 0 ? Number((current.amount / current.quantity).toFixed(2)) : 0;
          byProduct.set(id, current);
        });
      });
      const data = Array.from(byProduct.values()).map((v) => ({
        ...v,
        quantity: Number(v.quantity.toFixed(2)),
        amount: Number(v.amount.toFixed(2)),
      }));
      return { data, summary: { products: data.length } };
    }
    const response = await api.get('/reports/sales/by-product', { params: filters });
    return response.data;
  },

  // Purchase Reports
  getPurchaseRegister: async (filters: PurchaseRegisterFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      const rows = await offlinePurchaseRows(filters);
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 50);
      const start = (page - 1) * limit;
      const data = rows.slice(start, start + limit);
      const totalAmount = Number(rows.reduce((s, r) => s + Number(r.grandTotal || 0), 0).toFixed(2));
      const totalTax = Number(rows.reduce((s, r) => s + Number(r.totalTax || 0), 0).toFixed(2));
      return {
        data,
        pagination: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
        summary: {
          totalVouchers: rows.length,
          totalAmount,
          totalTax,
        },
      };
    }
    const response = await api.get('/reports/purchase/register', { params: filters });
    return response.data;
  },

  getPurchaseBySupplier: async (filters: { fromDate?: string; toDate?: string } = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      const rows = await offlinePurchaseRows(filters);
      const bySupplier = new Map<string, { supplierName: string; vouchers: number; quantity: number; totalAmount: number; paid: number; balance: number; lastPurchaseDate: string }>();
      rows.forEach((r) => {
        const key = String(r.supplierLedgerId || r.supplierName || 'unknown');
        const current = bySupplier.get(key) || {
          supplierName: r.supplierName || 'Unknown',
          vouchers: 0,
          quantity: 0,
          totalAmount: 0,
          paid: 0,
          balance: 0,
          lastPurchaseDate: r.date,
        };
        current.vouchers += 1;
        current.quantity += Number(r.quantity || 0);
        current.totalAmount += Number(r.grandTotal || 0);
        current.balance += Number(r.grandTotal || 0);
        if (new Date(r.date).getTime() > new Date(current.lastPurchaseDate).getTime()) current.lastPurchaseDate = r.date;
        bySupplier.set(key, current);
      });
      const data = Array.from(bySupplier.values()).map((v) => ({
        ...v,
        quantity: Number(v.quantity.toFixed(2)),
        totalAmount: Number(v.totalAmount.toFixed(2)),
        paid: Number(v.paid.toFixed(2)),
        balance: Number(v.balance.toFixed(2)),
      }));
      return { data, summary: { suppliers: data.length } };
    }
    const response = await api.get('/reports/purchase/by-supplier', { params: filters });
    return response.data;
  },

  // Stock Reports
  getCurrentStock: async (filters: CurrentStockFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
    }
    const response = await api.get('/reports/stock/current', { params: filters });
    return response.data;
  },

  getStockMovement: async (filters: StockMovementFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], pagination: { page: filters.page ?? 1, limit: filters.limit ?? 50, total: 0, totalPages: 1 }, summary: null };
    }
    const response = await api.get('/reports/stock/movement', { params: filters });
    return response.data;
  },

  getLowStock: async (): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [] };
    }
    const response = await api.get('/reports/stock/low');
    return response.data;
  },

  // Financial Reports
  getDayBook: async (filters: DayBookFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      const date = filters.date || new Date().toISOString().slice(0, 10);
      const vouchers = await voucherService.list();
      const onDate = (v: Voucher) =>
        v.status === 'ACTIVE' && String(v.date).slice(0, 10) === date;

      const sales = vouchers.filter((v) => v.type === 'SALES' && onDate(v));
      const purchase = vouchers.filter((v) => v.type === 'PURCHASE' && onDate(v));
      const receipts = vouchers.filter((v) => v.type === 'RECEIPT' && onDate(v));
      const payments = vouchers.filter((v) => v.type === 'PAYMENT' && onDate(v));

      const salesRows = sales.map((v) => ({
        type: 'Sales',
        reference: v.number,
        amount: voucherGrandTotal(v),
        date: v.date,
      }));
      const receiptRows = receipts.map((v) => ({
        type: 'Payment Received',
        reference: v.number,
        amount: voucherGrandTotal(v),
        date: v.date,
      }));
      const purchaseRows = purchase.map((v) => ({
        type: 'Purchase',
        reference: v.number,
        amount: voucherGrandTotal(v),
        date: v.date,
      }));
      const paymentRows = payments.map((v) => ({
        type: 'Payment Made',
        reference: v.number,
        amount: voucherGrandTotal(v),
        date: v.date,
      }));

      const totalReceipts =
        salesRows.reduce((s, r) => s + r.amount, 0) + receiptRows.reduce((s, r) => s + r.amount, 0);
      const totalPayments =
        purchaseRows.reduce((s, r) => s + r.amount, 0) + paymentRows.reduce((s, r) => s + r.amount, 0);

      return {
        date,
        receipts: { sales: salesRows, payments: receiptRows, total: totalReceipts },
        payments: { purchases: purchaseRows, payments: paymentRows, total: totalPayments },
        netCashFlow: totalReceipts - totalPayments,
      };
    }
    const response = await api.get('/reports/financial/daybook', { params: filters });
    return response.data;
  },

  getProfitAndLoss: async (filters: ProfitLossFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
    }
    const response = await api.get('/reports/financial/profit-loss', { params: filters });
    return response.data;
  },

  // Party Reports
  getCustomerOutstanding: async (): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
    }
    const response = await api.get('/reports/party/customer-outstanding');
    return response.data;
  },

  getSupplierPayable: async (): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
    }
    const response = await api.get('/reports/party/supplier-payable');
    return response.data;
  },

  // Payment Reports
  getPaymentReceived: async (filters: PaymentReceivedFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], pagination: { page: filters.page ?? 1, limit: filters.limit ?? 50, total: 0, totalPages: 1 }, summary: null };
    }
    const response = await api.get('/reports/payment/received', { params: filters });
    return response.data;
  },

  getPaymentMade: async (filters: PaymentMadeFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], pagination: { page: filters.page ?? 1, limit: filters.limit ?? 50, total: 0, totalPages: 1 }, summary: null };
    }
    const response = await api.get('/reports/payment/made', { params: filters });
    return response.data;
  },
};

export default reportService;

