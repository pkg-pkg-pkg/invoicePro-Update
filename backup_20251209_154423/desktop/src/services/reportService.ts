import api from './api';

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
    const response = await api.get('/reports/sales/register', { params: filters });
    return response.data;
  },

  getSalesSummary: async (filters: SalesSummaryFilters = {}): Promise<any> => {
    const response = await api.get('/reports/sales/summary', { params: filters });
    return response.data;
  },

  getSalesByCustomer: async (filters: SalesByCustomerFilters = {}): Promise<any> => {
    const response = await api.get('/reports/sales/by-customer', { params: filters });
    return response.data;
  },

  getSalesByProduct: async (filters: SalesByProductFilters = {}): Promise<any> => {
    const response = await api.get('/reports/sales/by-product', { params: filters });
    return response.data;
  },

  // Purchase Reports
  getPurchaseRegister: async (filters: PurchaseRegisterFilters = {}): Promise<any> => {
    const response = await api.get('/reports/purchase/register', { params: filters });
    return response.data;
  },

  getPurchaseBySupplier: async (filters: { fromDate?: string; toDate?: string } = {}): Promise<any> => {
    const response = await api.get('/reports/purchase/by-supplier', { params: filters });
    return response.data;
  },

  // Stock Reports
  getCurrentStock: async (filters: CurrentStockFilters = {}): Promise<any> => {
    const response = await api.get('/reports/stock/current', { params: filters });
    return response.data;
  },

  getStockMovement: async (filters: StockMovementFilters = {}): Promise<any> => {
    const response = await api.get('/reports/stock/movement', { params: filters });
    return response.data;
  },

  getLowStock: async (): Promise<any> => {
    const response = await api.get('/reports/stock/low');
    return response.data;
  },

  // Financial Reports
  getDayBook: async (filters: DayBookFilters = {}): Promise<any> => {
    const response = await api.get('/reports/financial/daybook', { params: filters });
    return response.data;
  },

  getProfitAndLoss: async (filters: ProfitLossFilters = {}): Promise<any> => {
    const response = await api.get('/reports/financial/profit-loss', { params: filters });
    return response.data;
  },

  // Party Reports
  getCustomerOutstanding: async (): Promise<any> => {
    const response = await api.get('/reports/party/customer-outstanding');
    return response.data;
  },

  getSupplierPayable: async (): Promise<any> => {
    const response = await api.get('/reports/party/supplier-payable');
    return response.data;
  },

  // Payment Reports
  getPaymentReceived: async (filters: PaymentReceivedFilters = {}): Promise<any> => {
    const response = await api.get('/reports/payment/received', { params: filters });
    return response.data;
  },

  getPaymentMade: async (filters: PaymentMadeFilters = {}): Promise<any> => {
    const response = await api.get('/reports/payment/made', { params: filters });
    return response.data;
  },
};

export default reportService;

