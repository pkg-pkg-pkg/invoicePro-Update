export type VoucherType =
  | 'sales_invoice'
  | 'quotation'
  | 'proforma'
  | 'sales_order'
  | 'dispatch_note'
  | 'collection'
  | 'credit_adjustment'
  | 'purchase_bill'
  | 'purchase_order'
  | 'vendor_payment'
  | 'debit_note'
  | 'expense'
  | 'receipt'
  | 'payment'
  | 'journal';

export type ItemRecord = {
  item_id?: string;
  id?: string;
  name?: string;
  sku?: string;
  hsn_code?: string;
  category?: string;
  unit?: string;
  godown?: string;
  sale_rate?: number;
  purchase_rate?: number;
  tax_pct?: number;
  stock?: number;
  extra_data?: string | Record<string, unknown>;
};

export type PartyRecord = {
  customer_id?: string;
  id?: string;
  name?: string;
  company?: string;
  gstin?: string;
  mobile?: string;
  email?: string;
  balance?: number;
  status?: string;
  partyType?: string;
  extra_data?: string | Record<string, unknown>;
};

export type VoucherRecord = {
  id?: string;
  documentNo?: string;
  date?: string;
  partyName?: string;
  partyId?: string;
  amount?: number;
  gstAmount?: number;
  balanceDue?: number;
  status?: string;
  voucherType?: string;
};

export type DashboardSummary = {
  todaySales: number;
  todayReceipts: number;
  outstandingAmount: number;
  stockValue: number;
  todaySalesVsPriorPct: number;
  todayReceiptsVsPriorPct: number;
  outstandingVsPriorPct: number;
  stockValueVsPriorPct: number;
  financialYear: string;
};

export type DayBookEntry = {
  id: string;
  date: string;
  voucherType: string;
  voucherNumber: string;
  partyName: string;
  description: string;
  debit: number;
  credit: number;
  amount: number;
  createdBy: string;
  isDeleted?: boolean;
};

export type DayBookResponse = {
  entries: DayBookEntry[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    totalVouchers: number;
    totalSales: number;
    totalReceipts: number;
  };
};

export type LedgerAccount = {
  id: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
};

export type ReportResponse = {
  report: string;
  rows: Record<string, unknown>[];
  from?: string;
  to?: string;
  date?: string;
};

export type GstReportResponse = {
  report: string;
  month?: string;
  year?: string;
  b2b: Record<string, unknown>[];
  b2c: Record<string, unknown>[];
  hsnSummary: Record<string, unknown>[];
  generatedAt: string;
};
