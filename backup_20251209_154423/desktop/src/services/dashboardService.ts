import api from './api';

export interface DashboardSummary {
  totalSales: number;
  totalPurchase: number;
  salesCount: number;
  purchaseCount: number;
  totalTax: number;
  cashInHand: number;
  bankBalance: number;
  totalBalance: number;
  profitLoss: number;
  totalOutstanding: number;
  outstandingCount: number;
  totalPayable: number;
  payableCount: number;
  overdueAmount: number;
  overdueCount: number;
  period: string;
}

export interface SalesAnalytics {
  analytics: Array<{
    date: string;
    sales: number;
    count: number;
    tax: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    amount: number;
  }>;
  totalSales: number;
  totalCount: number;
  period: string;
  groupBy: string;
}

export interface OutstandingSummary {
  customers: Array<{
    id: string;
    name: string;
    currentBalance: number;
    creditDays: number;
  }>;
  totalOutstanding: number;
  count: number;
}

export interface PayableSummary {
  suppliers: Array<{
    id: string;
    name: string;
    currentBalance: number;
    creditDays: number;
  }>;
  totalPayable: number;
  count: number;
}

export interface RecentTransactions {
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    type: string;
    date: string;
    grandTotal: number;
    paymentStatus: string;
    partyType: string;
  }>;
  payments: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    paymentMode: string;
  }>;
}

export const dashboardService = {
  // Get dashboard summary
  getDashboardSummary: async (period: 'today' | 'week' | 'month' | 'year' = 'today'): Promise<DashboardSummary> => {
    const response = await api.get('/dashboard/summary', {
      params: { period }
    });
    return response.data;
  },

  // Get sales analytics
  getSalesAnalytics: async (
    period: 'week' | 'month' | 'year' = 'month',
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<SalesAnalytics> => {
    const response = await api.get('/dashboard/sales-analytics', {
      params: { period, groupBy }
    });
    return response.data;
  },

  // Get outstanding summary
  getOutstandingSummary: async (): Promise<OutstandingSummary> => {
    const response = await api.get('/dashboard/outstanding');
    return response.data;
  },

  // Get payable summary
  getPayableSummary: async (): Promise<PayableSummary> => {
    const response = await api.get('/dashboard/payable');
    return response.data;
  },

  // Get recent transactions
  getRecentTransactions: async (limit: number = 10): Promise<RecentTransactions> => {
    const response = await api.get('/dashboard/recent-transactions', {
      params: { limit }
    });
    return response.data;
  },
};

export default dashboardService;

