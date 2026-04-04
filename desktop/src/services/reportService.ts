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
      return {
        data: [],
        pagination: { page: filters.page ?? 1, limit: filters.limit ?? 50, total: 0, totalPages: 1 },
        summary: {
          totalInvoices: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalBalance: 0,
          totalTax: 0,
        },
      };
    }
    const response = await api.get('/reports/sales/register', { params: filters });
    return response.data;
  },

  getSalesSummary: async (filters: SalesSummaryFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
    }
    const response = await api.get('/reports/sales/summary', { params: filters });
    return response.data;
  },

  getSalesByCustomer: async (filters: SalesByCustomerFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
    }
    const response = await api.get('/reports/sales/by-customer', { params: filters });
    return response.data;
  },

  getSalesByProduct: async (filters: SalesByProductFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
    }
    const response = await api.get('/reports/sales/by-product', { params: filters });
    return response.data;
  },

  // Purchase Reports
  getPurchaseRegister: async (filters: PurchaseRegisterFilters = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], pagination: { page: filters.page ?? 1, limit: filters.limit ?? 50, total: 0, totalPages: 1 }, summary: null };
    }
    const response = await api.get('/reports/purchase/register', { params: filters });
    return response.data;
  },

  getPurchaseBySupplier: async (filters: { fromDate?: string; toDate?: string } = {}): Promise<any> => {
    if (isOfflineRuntime()) {
      return { data: [], summary: null };
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
      return { data: [], summary: null };
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

