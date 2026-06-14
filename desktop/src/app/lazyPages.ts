import { lazy } from 'react';

/** Route-level code splitting — only Login/Dashboard/Layout stay eager in App.tsx */
export const LazyPartyForm = lazy(() => import('../pages/Parties/PartyForm'));
export const LazyPartyLedgerReport = lazy(() => import('../pages/PartyLedgerReport'));
export const LazyOutstandingAgingReport = lazy(() => import('../pages/Reports/OutstandingAgingReport'));
export const LazyDashboardKpiDrillPage = lazy(() => import('../pages/dashboard/DashboardKpiDrillPage'));
export const LazyLowStockReport = lazy(() => import('../pages/Reports/LowStockReport'));
export const LazyLedgerStatementByLedgerId = lazy(() => import('../pages/LedgerStatementByLedgerId'));
export const LazyPurchaseInvoices = lazy(() => import('../pages/PurchaseInvoices'));
export const LazyDebitNotes = lazy(() => import('../pages/DebitNotes'));
export const LazyStorePage = lazy(() => import('../pages/Store/StorePage'));
export const LazyGSTR1Report = lazy(() => import('../pages/GST/GSTR1Report'));
export const LazyGSTR2Report = lazy(() => import('../pages/GST/GSTR2Report'));
export const LazyGSTR3BReport = lazy(() => import('../pages/GST/GSTR3BReport'));
export const LazyGSTR9Report = lazy(() => import('../pages/GST/GSTR9Report'));
export const LazyEWayBillPage = lazy(() => import('../pages/GST/EWayBillPage'));
export const LazyHSNSummary = lazy(() => import('../pages/GST/HSNSummary'));
export const LazyManualExpenseEntry = lazy(() => import('../pages/Expenses/ManualExpenseEntry'));
export const LazyPayments = lazy(() => import('../pages/Payments'));
export const LazyPrintWindow = lazy(() => import('../pages/PrintWindow'));
export const LazySchemes = lazy(() => import('../pages/Schemes'));
export const LazySmartSchemeForm = lazy(() => import('../pages/Schemes/SmartSchemeForm'));
export const LazyRetailerSchemeDashboard = lazy(() => import('../pages/Schemes/RetailerSchemeDashboard'));
export const LazyOverdueTracker = lazy(() => import('../pages/Schemes/OverdueTracker'));
export const LazyLedgerAccountList = lazy(() => import('../pages/Masters/LedgerAccounts/LedgerAccountList'));
export const LazyLedgerAccountForm = lazy(() => import('../pages/Masters/LedgerAccounts/LedgerAccountForm'));
export const LazyChartOfAccountsPage = lazy(() => import('../pages/Masters/LedgerAccounts/ChartOfAccountsPage'));
export const LazyAccountingStructureAuditPage = lazy(
  () => import('../pages/Masters/LedgerAccounts/AccountingStructureAuditPage')
);
export const LazyAccountingIntegrityAuditPage = lazy(
  () => import('../pages/Masters/LedgerAccounts/AccountingIntegrityAuditPage')
);
export const LazyFinancialStatementReadinessAuditPage = lazy(
  () => import('../pages/Masters/LedgerAccounts/FinancialStatementReadinessAuditPage')
);
export const LazyInventoryItemList = lazy(() => import('../pages/Masters/InventoryItems/InventoryItemList'));
export const LazyGodownList = lazy(() => import('../pages/Masters/Godowns/GodownList'));
export const LazyImportFromErp = lazy(() => import('../pages/ImportFromErp'));
export const LazyApprovalPendingPage = lazy(() => import('../pages/Approvals/ApprovalPendingPage'));
export const LazyGodownForm = lazy(() => import('../pages/Masters/Godowns/GodownForm'));
export const LazyBankLedgerList = lazy(() => import('../pages/Masters/LedgerAccounts/BankLedgerList'));
export const LazyItemsWorkspace = lazy(() => import('../pages/items/ItemsWorkspace'));
export const LazyCustomersListPage = lazy(() => import('../pages/customers/CustomersListPage'));
export const LazyCustomerDetailPage = lazy(() => import('../pages/customers/CustomerDetailPage'));
export const LazyCustomerLedgerStatementPage = lazy(() => import('../pages/customers/CustomerLedgerStatementPage'));
export const LazySalesDocumentPage = lazy(() => import('../pages/sales/SalesDocumentPage'));
export const LazyCollectionFormPage = lazy(() => import('../pages/sales/CollectionFormPage'));
export const LazySalesPipelineForm = lazy(() => import('../pages/sales/SalesPipelineForm'));
export const LazyPurchaseDocumentPage = lazy(() => import('../pages/purchase/PurchaseDocumentPage'));
export const LazyPurchasePipelineForm = lazy(() => import('../pages/purchase/PurchasePipelineForm'));
export const LazyInventoryItemDetail = lazy(() => import('../pages/Masters/InventoryItems/InventoryItemDetail'));
export const LazyPriceListList = lazy(() => import('../pages/Masters/PriceLists/PriceListList'));
export const LazyPriceListForm = lazy(() => import('../pages/Masters/PriceLists/PriceListForm'));
export const LazyStockAdjustmentList = lazy(() => import('../pages/Masters/StockAdjustments/StockAdjustmentList'));
export const LazyStockAdjustmentForm = lazy(() => import('../pages/Masters/StockAdjustments/StockAdjustmentForm'));
export const LazySalesVoucherList = lazy(() => import('../pages/Vouchers/Sales/SalesVoucherList'));
export const LazySalesVoucherForm = lazy(() => import('../pages/Vouchers/Sales/SalesVoucherForm'));
export const LazySalesReturnVoucherList = lazy(() => import('../pages/Vouchers/SalesReturn/SalesReturnVoucherList'));
export const LazySalesReturnVoucherForm = lazy(() => import('../pages/Vouchers/SalesReturn/SalesReturnVoucherForm'));
export const LazyPurchaseVoucherList = lazy(() => import('../pages/Vouchers/Purchase/PurchaseVoucherList'));
export const LazyPurchaseVoucherForm = lazy(() => import('../pages/Vouchers/Purchase/PurchaseVoucherForm'));
export const LazyPurchaseReturnVoucherList = lazy(() => import('../pages/Vouchers/PurchaseReturn/PurchaseReturnVoucherList'));
export const LazyPurchaseReturnVoucherForm = lazy(() => import('../pages/Vouchers/PurchaseReturn/PurchaseReturnVoucherForm'));
export const LazyPaymentVoucherList = lazy(() => import('../pages/Vouchers/Payment/PaymentVoucherList'));
export const LazyReceiptVoucherList = lazy(() => import('../pages/Vouchers/Receipt/ReceiptVoucherList'));
export const LazyJournalVoucherList = lazy(() => import('../pages/Vouchers/Journal/JournalVoucherList'));
export const LazyJournalVoucherForm = lazy(() => import('../pages/Vouchers/Journal/JournalVoucherForm'));
export const LazyVouchersHub = lazy(() => import('../pages/Vouchers/VouchersHub'));
export const LazyMoneyVouchersHub = lazy(() => import('../pages/Vouchers/MoneyVouchersHub'));
export const LazyPaymentVoucherPage = lazy(() => import('../pages/Vouchers/PaymentReceipt/PaymentVoucher'));
export const LazyPartyOutstandingReport = lazy(() => import('../pages/Reports/PartyOutstandingReport'));
export const LazyAllLedgersPage = lazy(() => import('../pages/ledgers/AllLedgersPage'));
export const LazyCreditorsListPage = lazy(() => import('../pages/ledgers/CreditorsListPage'));
export const LazyActivate = lazy(() => import('../pages/Activate'));
