import { VoucherType } from './vouchers';

export type SummaryPeriod = 'today' | 'week' | 'month' | 'lastMonth' | 'year';

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
  /** Sum of RECEIPT vouchers in the filtered period (today when period=today). */
  todayReceipts?: number;
  /** Current inventory valuation (all active items). */
  stockValue?: number;
  /** Count of SALES invoices with balance > 0. */
  pendingInvoiceCount?: number;
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

/** Sales voucher line used for FIFO outstanding aging. */
export interface AgingSaleVoucher {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  partyLedgerId: string;
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
  partyName?: string;
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
  /** Units needed to reach reorder level */
  requiredQuantity?: number;
  supplier?: string;
}
