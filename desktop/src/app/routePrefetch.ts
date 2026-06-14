type ImportFn = () => Promise<unknown>;

/** Every lazy route chunk — warmed in background after dashboard is ready. */
const ALL_LAZY_IMPORTS: ImportFn[] = [
  () => import('../pages/Parties/PartyForm'),
  () => import('../pages/PartyLedgerReport'),
  () => import('../pages/Reports/OutstandingAgingReport'),
  () => import('../pages/dashboard/DashboardKpiDrillPage'),
  () => import('../pages/Reports/LowStockReport'),
  () => import('../pages/LedgerStatementByLedgerId'),
  () => import('../pages/PurchaseInvoices'),
  () => import('../pages/DebitNotes'),
  () => import('../pages/Store/StorePage'),
  () => import('../pages/GST/GSTR1Report'),
  () => import('../pages/GST/GSTR2Report'),
  () => import('../pages/GST/GSTR3BReport'),
  () => import('../pages/GST/GSTR9Report'),
  () => import('../pages/GST/EWayBillPage'),
  () => import('../pages/GST/HSNSummary'),
  () => import('../pages/Expenses/ManualExpenseEntry'),
  () => import('../pages/Payments'),
  () => import('../pages/PrintWindow'),
  () => import('../pages/Schemes/SmartSchemeForm'),
  () => import('../pages/Schemes/RetailerSchemeDashboard'),
  () => import('../pages/Schemes/OverdueTracker'),
  () => import('../pages/Masters/LedgerAccounts/LedgerAccountList'),
  () => import('../pages/Masters/LedgerAccounts/LedgerAccountForm'),
  () => import('../pages/Masters/InventoryItems/InventoryItemList'),
  () => import('../pages/items/ItemsWorkspace'),
  () => import('../pages/Masters/Godowns/GodownList'),
  () => import('../pages/ImportFromErp'),
  () => import('../pages/Approvals/ApprovalPendingPage'),
  () => import('../pages/Masters/Godowns/GodownForm'),
  () => import('../pages/Masters/LedgerAccounts/BankLedgerList'),
  () => import('../pages/customers/CustomerDetailPage'),
  () => import('../pages/sales/CollectionFormPage'),
  () => import('../pages/sales/SalesPipelineForm'),
  () => import('../pages/purchase/PurchasePipelineForm'),
  () => import('../pages/Masters/InventoryItems/InventoryItemDetail'),
  () => import('../pages/Masters/PriceLists/PriceListList'),
  () => import('../pages/Masters/PriceLists/PriceListForm'),
  () => import('../pages/Masters/StockAdjustments/StockAdjustmentList'),
  () => import('../pages/Masters/StockAdjustments/StockAdjustmentForm'),
  () => import('../pages/Vouchers/Sales/SalesVoucherList'),
  () => import('../pages/Vouchers/Sales/SalesVoucherForm'),
  () => import('../pages/Vouchers/SalesReturn/SalesReturnVoucherList'),
  () => import('../pages/Vouchers/SalesReturn/SalesReturnVoucherForm'),
  () => import('../pages/Vouchers/Purchase/PurchaseVoucherList'),
  () => import('../pages/Vouchers/Purchase/PurchaseVoucherForm'),
  () => import('../pages/Vouchers/PurchaseReturn/PurchaseReturnVoucherList'),
  () => import('../pages/Vouchers/PurchaseReturn/PurchaseReturnVoucherForm'),
  () => import('../pages/Vouchers/Payment/PaymentVoucherList'),
  () => import('../pages/Vouchers/Receipt/ReceiptVoucherList'),
  () => import('../pages/Vouchers/Journal/JournalVoucherList'),
  () => import('../pages/Vouchers/Journal/JournalVoucherForm'),
  () => import('../pages/Vouchers/VouchersHub'),
  () => import('../pages/Vouchers/MoneyVouchersHub'),
  () => import('../pages/Vouchers/PaymentReceipt/PaymentVoucher'),
  () => import('../pages/Activate'),
];

const warmed = new Set<string>();

function scheduleIdle(work: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(work, { timeout: 1500 });
  } else {
    window.setTimeout(work, 50);
  }
}

/** Staggered background warm-up of all lazy route chunks (after login / dashboard). */
export function prefetchAllAppRoutes(): void {
  const BATCH = 4;
  const runFrom = (start: number) => {
    const slice = ALL_LAZY_IMPORTS.slice(start, start + BATCH);
    if (!slice.length) return;
    void Promise.all(slice.map((fn) => fn().catch(() => undefined))).finally(() => {
      if (start + BATCH < ALL_LAZY_IMPORTS.length) {
        scheduleIdle(() => runFrom(start + BATCH));
      }
    });
  };
  scheduleIdle(() => runFrom(0));
}

const PATH_IMPORTS: Array<{ prefix: string; fn: ImportFn }> = [
  { prefix: '/vouchers/sales', fn: () => import('../pages/Vouchers/Sales/SalesVoucherList') },
  { prefix: '/vouchers/purchase', fn: () => import('../pages/Vouchers/Purchase/PurchaseVoucherList') },
  { prefix: '/vouchers/payment-vouchers', fn: () => import('../pages/Vouchers/Payment/PaymentVoucherList') },
  { prefix: '/vouchers/receipt-vouchers', fn: () => import('../pages/Vouchers/Receipt/ReceiptVoucherList') },
  { prefix: '/vouchers/journal', fn: () => import('../pages/Vouchers/Journal/JournalVoucherList') },
  { prefix: '/vouchers', fn: () => import('../pages/Vouchers/VouchersHub') },
  { prefix: '/masters/bank-accounts', fn: () => import('../pages/Masters/LedgerAccounts/BankLedgerList') },
  { prefix: '/masters/ledger-accounts', fn: () => import('../pages/Masters/LedgerAccounts/LedgerAccountList') },
  { prefix: '/masters/inventory-items', fn: () => import('../pages/items/ItemsWorkspace') },
  { prefix: '/items', fn: () => import('../pages/items/ItemsWorkspace') },
  { prefix: '/masters/godowns', fn: () => import('../pages/Masters/Godowns/GodownList') },
  { prefix: '/masters/price-lists', fn: () => import('../pages/Masters/PriceLists/PriceListList') },
  { prefix: '/masters/stock-adjustments', fn: () => import('../pages/Masters/StockAdjustments/StockAdjustmentList') },
  { prefix: '/sales/', fn: () => import('../pages/sales/SalesPipelineForm') },
  { prefix: '/purchase/', fn: () => import('../pages/purchase/PurchasePipelineForm') },
  { prefix: '/gst/gstr', fn: () => import('../pages/GST/GSTR1Report') },
  { prefix: '/gst/e-way', fn: () => import('../pages/GST/EWayBillPage') },
  { prefix: '/reports/outstanding', fn: () => import('../pages/Reports/OutstandingAgingReport') },
  { prefix: '/customers/', fn: () => import('../pages/customers/CustomerDetailPage') },
  { prefix: '/parties/', fn: () => import('../pages/Parties/PartyForm') },
  { prefix: '/expenses', fn: () => import('../pages/Expenses/ManualExpenseEntry') },
  { prefix: '/store', fn: () => import('../pages/Store/StorePage') },
];

/** Prefetch chunk for a navigation path (sidebar hover / focus). */
export function prefetchRoutePath(path: string): void {
  const normalized = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  if (warmed.has(normalized)) return;
  warmed.add(normalized);

  const match = PATH_IMPORTS.find(
    ({ prefix }) => normalized === prefix.replace(/\/+$/, '') || normalized.startsWith(prefix)
  );
  if (match) {
    void match.fn().catch(() => undefined);
  }
}
