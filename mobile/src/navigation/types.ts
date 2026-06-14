export type SalesStackParamList = {
  SalesHub: undefined;
  TaxInvoices: undefined;
  TaxInvoiceForm: undefined;
  Quotations: undefined;
  Proforma: undefined;
  SalesOrders: undefined;
  DispatchNotes: undefined;
  Collections: undefined;
  CreditAdjustments: undefined;
  RecurringSales: undefined;
};

export type PurchaseStackParamList = {
  PurchaseHub: undefined;
  PurchaseBills: undefined;
  PurchaseBillForm: undefined;
  PurchaseOrders: undefined;
  VendorPayments: undefined;
  DebitNotes: undefined;
  Expenses: undefined;
  RecurringBills: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  ItemsHub: undefined;
  ItemsList: undefined;
  ItemForm: undefined;
  PriceLists: undefined;
  InventoryAdjustments: undefined;
  GodownMaster: undefined;
  BankingHub: undefined;
  BankAccounts: undefined;
  LedgerAccounts: undefined;
  ReceiptVouchers: undefined;
  PaymentVouchers: undefined;
  PaymentReceiptDesk: undefined;
  JournalVouchers: undefined;
  Customers: undefined;
  CustomerForm: undefined;
  CustomerLedger: { partyId?: string };
  ReportsMenu: undefined;
  GSTReports: undefined;
  GSTR1: undefined;
  GSTR2: undefined;
  GSTR3B: undefined;
  GSTR9: undefined;
  HSNSummary: undefined;
  Settings: undefined;
  AccessRestricted: { module?: string };
};
