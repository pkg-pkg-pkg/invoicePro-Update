import { VoucherType } from './vouchers';

export type SummaryPeriod = 'today' | 'week' | 'month' | 'year';

export interface DashboardSummary {
  totalSales: number;
  salesCount: number;
  totalPurchase: number;
  purchaseCount: number;
  totalOutstanding: number;
  outstandingCount: number;
  totalPayable: number;
  payableCount: number;
  cashInHand: number;
  bankBalance: number;
  profitLoss: number;
  overdueAmount: number;
  overdueCount: number;
}

export interface SalesAnalyticsData {
  date: string;
  sales: number;
  tax: number;
}

export interface TopProduct {
  productName: string;
  amount: number;
}

export interface SalesAnalytics {
  analytics: SalesAnalyticsData[];
  topProducts: TopProduct[];
}

export interface CustomerSummary {
  id: string;
  name: string;
  currentBalance: number;
}

export interface SupplierSummary {
  id: string;
  name: string;
  currentBalance: number;
}

export interface TransactionInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  grandTotal: number;
  paymentStatus: string;
  type: VoucherType;
}

export interface TransactionPayment {
  id: string;
  type: 'RECEIPT' | 'PAYMENT';
  date: string;
  paymentMode: string;
  amount: number;
}

export interface RecentReturn {
  id: string;
  number: string;
  date: string;
  party: string;
  amount: number;
}

export interface RecentTransactions {
  invoices: TransactionInvoice[];
  payments: TransactionPayment[];
  creditNotes: RecentReturn[];
  debitNotes: RecentReturn[];
}

export interface GstSnapshot {
  outputGst: number;
  inputItc: number;
  payable: number;
  receivable: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
}
