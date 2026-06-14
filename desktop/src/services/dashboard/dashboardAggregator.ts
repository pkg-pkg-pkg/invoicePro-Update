import { parseISO } from 'date-fns';
import { LedgerAccount, LedgerGroup } from '../../types/masters';
import { Voucher, VoucherLine, VoucherType } from '../../types/vouchers';
import {
  AgingSaleVoucher,
  CustomerSummary,
  DashboardSummary,
  GstSnapshot,
  LowStockItem,
  RecentReturn,
  RecentTransactions,
  SalesAnalytics,
  SalesAnalyticsData,
  SummaryPeriod,
  SupplierSummary,
  TopProduct,
} from '../../types/dashboard';
import { inventoryItemService } from '../masters/inventoryItemService';
import { listLowStockItems } from '../inventory/lowStockService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerGroupService } from '../masters/ledgerGroupService';
import { voucherService } from '../vouchers/voucherService';
import { billReferenceService } from '../settlement/billReferenceService';
import { sumPurchaseExclusivePreGst, sumSalesItemExclusiveRevenue } from '../reports/preGstProfitService';
import {
  computeSalesInvoicePaymentStatus,
  countPendingSalesInvoices,
} from '../vouchers/invoicePaymentStatus';

const SALES_TYPES = new Set<VoucherType>(['SALES']);
const SALES_RETURN_TYPES = new Set<VoucherType>(['SALES_RETURN']);
const PURCHASE_TYPES = new Set<VoucherType>(['PURCHASE']);
const PURCHASE_RETURN_TYPES = new Set<VoucherType>(['PURCHASE_RETURN']);
const RECEIPT_TYPES = new Set<VoucherType>(['RECEIPT']);
const PAYMENT_TYPES = new Set<VoucherType>(['PAYMENT']);

const CUSTOMER_GROUP_IDS = new Set(['grp-sundry-debtors']);
const SUPPLIER_GROUP_IDS = new Set(['grp-sundry-creditors']);
const CASH_ROOT_ID = 'grp-cash-in-hand';
const BANK_ROOT_IDS = new Set(['grp-bank-accounts', 'grp-bank-overdraft']);
const GST_GROUP_ID = 'grp-duties-taxes';

const toDateSafe = (value: string | undefined | null): Date | null => {
  if (!value) return null;
  try {
    return parseISO(value);
  } catch {
    return null;
  }
};

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

/** Inclusive range on calendar `fromYmd` / `toYmd` (yyyy-mm-dd). */
const isInDateRangeInclusive = (dateISO: string | undefined | null, fromYmd: string, toYmd: string): boolean => {
  const d = toDateSafe(dateISO ?? '');
  if (!d) return false;
  const from = startOfDay(parseISO(fromYmd.length > 10 ? fromYmd.slice(0, 10) : fromYmd));
  const to = endOfDay(parseISO(toYmd.length > 10 ? toYmd.slice(0, 10) : toYmd));
  const t = d.getTime();
  return t >= from.getTime() && t <= to.getTime();
};

const isInPeriod = (dateISO: string, period: SummaryPeriod): boolean => {
  const date = toDateSafe(dateISO);
  if (!date) return false;
  const now = new Date();
  const today = startOfDay(now).getTime();
  const target = startOfDay(date).getTime();

  switch (period) {
    case 'today':
      return target === today;
    case 'week': {
      const weekday = startOfDay(now);
      const dayOfWeek = weekday.getDay();
      const weekStart = startOfDay(new Date(weekday.setDate(weekday.getDate() - dayOfWeek)));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return target >= weekStart.getTime() && target <= weekEnd.getTime();
    }
    case 'month':
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    case 'lastMonth': {
      const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return date.getMonth() === m && date.getFullYear() === y;
    }
    case 'year':
      return date.getFullYear() === now.getFullYear();
    default:
      return false;
  }
};

const voucherAmount = (voucher: Voucher): number => {
  if (!Array.isArray(voucher.lines)) return 0;
  const debit = voucher.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
  const credit = voucher.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);
  return Number(Math.max(debit, credit).toFixed(2));
};

const buildGroupMap = (groups: LedgerGroup[]) => {
  const map = new Map<string, LedgerGroup>();
  groups.forEach((group) => map.set(group.id, group));
  return map;
};

const isDescendantOf = (groupId: string | undefined, roots: Set<string>, groupMap: Map<string, LedgerGroup>): boolean => {
  let current = groupId ?? null;
  while (current) {
    if (roots.has(current)) return true;
    const parent = groupMap.get(current)?.parentGroupId ?? null;
    current = parent;
  }
  return false;
};

const isDescendantOfSingle = (groupId: string | undefined, root: string, groupMap: Map<string, LedgerGroup>): boolean => {
  return isDescendantOf(groupId, new Set([root]), groupMap);
};

const summarizeLedgers = (
  ledgers: LedgerAccount[],
  groupMap: Map<string, LedgerGroup>
): {
  customers: CustomerSummary[];
  suppliers: SupplierSummary[];
  cashBalance: number;
  bankBalance: number;
} => {
  const customers: CustomerSummary[] = [];
  const suppliers: SupplierSummary[] = [];
  let cashBalance = 0;
  let bankBalance = 0;

  for (const ledger of ledgers) {
    if (CUSTOMER_GROUP_IDS.has(ledger.groupId) && ledger.currentBalance > 0) {
      customers.push({
        id: ledger.id,
        name: ledger.name,
        currentBalance: Number(ledger.currentBalance.toFixed(2)),
      });
    }

    if (SUPPLIER_GROUP_IDS.has(ledger.groupId) && ledger.currentBalance < 0) {
      suppliers.push({
        id: ledger.id,
        name: ledger.name,
        currentBalance: Number(Math.abs(ledger.currentBalance).toFixed(2)),
      });
    }

    if (ledger.isCashBank) {
      if (isDescendantOfSingle(ledger.groupId, CASH_ROOT_ID, groupMap)) {
        cashBalance += ledger.currentBalance;
      } else if (isDescendantOf(ledger.groupId, BANK_ROOT_IDS, groupMap)) {
        bankBalance += ledger.currentBalance;
      } else {
        // fallback: treat as bank if not explicitly cash
        bankBalance += ledger.currentBalance;
      }
    }
  }

  return {
    customers,
    suppliers,
    cashBalance: Number(cashBalance.toFixed(2)),
    bankBalance: Number(bankBalance.toFixed(2)),
  };
};

const weekKey = (date: Date): string => {
  const tmp = startOfDay(date);
  const firstDayOfYear = new Date(tmp.getFullYear(), 0, 1);
  const pastDays = Math.floor((tmp.getTime() - firstDayOfYear.getTime()) / 86400000);
  const week = Math.floor((pastDays + firstDayOfYear.getDay()) / 7) + 1;
  return `${tmp.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

const groupKey = (dateISO: string, groupBy: 'day' | 'week' | 'month'): string => {
  const date = toDateSafe(dateISO);
  if (!date) return 'invalid';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (groupBy === 'day') return `${yyyy}-${mm}-${dd}`;
  if (groupBy === 'month') return `${yyyy}-${mm}`;
  return weekKey(date);
};

const lineAmount = (line: VoucherLine): number => {
  const debit = Number(line.debit ?? 0);
  const credit = Number(line.credit ?? 0);
  return debit > 0 ? debit : credit;
};

const coalesceName = (preferred?: string | null, fallback?: string): string => {
  return (preferred ?? fallback ?? '').trim() || 'Unnamed';
};

const looksLikeGstLedger = (ledger?: LedgerAccount, line?: VoucherLine): boolean => {
  const lid = String(line?.ledgerId || '').toLowerCase();
  const lname = String(ledger?.name || '').toLowerCase();
  const token = `${lid} ${lname}`;
  return token.includes('cgst') || token.includes('sgst') || token.includes('igst') || token.includes('gst');
};

const gstDirectionForVoucher = (voucherType: VoucherType): 'output' | 'input' | null => {
  if (SALES_TYPES.has(voucherType) || SALES_RETURN_TYPES.has(voucherType)) return 'output';
  if (PURCHASE_TYPES.has(voucherType) || PURCHASE_RETURN_TYPES.has(voucherType)) return 'input';
  return null;
};

const OUTPUT_GST_LEDGER_IDS = new Set(['led-cgst-output', 'led-sgst-output', 'led-igst-output']);
const INPUT_GST_LEDGER_IDS = new Set(['led-cgst-input', 'led-sgst-input', 'led-igst-input']);

const buildDashboardSummaryFromFiltered = (
  filtered: Voucher[],
  allVouchers: Voucher[],
  ledgers: LedgerAccount[],
  groupMap: Map<string, LedgerGroup>
): DashboardSummary => {
  const sumForTypes = (types: Set<VoucherType>) =>
    filtered.filter((voucher) => types.has(voucher.type)).reduce((sum, voucher) => sum + voucherAmount(voucher), 0);

  const totalSales = sumForTypes(SALES_TYPES);
  const totalSalesReturns = sumForTypes(SALES_RETURN_TYPES);
  const netSales = Number(Math.max(totalSales - totalSalesReturns, 0).toFixed(2));
  const salesCount = filtered.filter((voucher) => SALES_TYPES.has(voucher.type)).length;

  const totalPurchases = sumForTypes(PURCHASE_TYPES);
  const totalPurchaseReturns = sumForTypes(PURCHASE_RETURN_TYPES);
  const netPurchase = Number(Math.max(totalPurchases - totalPurchaseReturns, 0).toFixed(2));
  const purchaseCount = filtered.filter((voucher) => PURCHASE_TYPES.has(voucher.type)).length;

  const { customers, suppliers, cashBalance, bankBalance } = summarizeLedgers(ledgers, groupMap);

  const preGstSalesItems = sumSalesItemExclusiveRevenue(filtered);
  const preGstPurchases = sumPurchaseExclusivePreGst(filtered);

  const todayReceipts = filtered
    .filter((voucher) => RECEIPT_TYPES.has(voucher.type))
    .reduce((sum, voucher) => sum + voucherAmount(voucher), 0);

  const pendingInvoiceCount = countPendingSalesInvoices(allVouchers);

  return {
    totalSales: netSales,
    salesCount,
    totalPurchase: netPurchase,
    purchaseCount,
    totalOutstanding: customers.reduce((sum, c) => sum + c.currentBalance, 0),
    outstandingCount: customers.length,
    totalPayable: suppliers.reduce((sum, s) => sum + s.currentBalance, 0),
    payableCount: suppliers.length,
    cashInHand: cashBalance,
    bankBalance,
    /** Pre-GST trading margin: taxable sales lines minus purchase subtotals (GST excluded). */
    profitLoss: Number((preGstSalesItems - preGstPurchases).toFixed(2)),
    overdueAmount: 0,
    overdueCount: 0,
    todayReceipts: Number(todayReceipts.toFixed(2)),
    pendingInvoiceCount,
  };
};

async function computeStockValue(): Promise<number> {
  const items = await inventoryItemService.list({ includeInactive: false });
  const total = items
    .filter((item) => item.status === 'ACTIVE')
    .reduce((sum, item) => {
      const rate =
        Number(item.pricing?.sale ?? 0) ||
        Number(item.pricing?.purchase ?? 0) ||
        (item.openingStock > 0 ? item.openingValue / item.openingStock : 0);
      return sum + Number(item.currentStock || 0) * rate;
    }, 0);
  return Number(total.toFixed(2));
}

const attachStockValue = async (summary: DashboardSummary): Promise<DashboardSummary> => ({
  ...summary,
  stockValue: await computeStockValue(),
});

export const dashboardAggregator = {
  async summary(period: SummaryPeriod): Promise<DashboardSummary> {
    const [vouchers, ledgers, groups] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: true }),
      ledgerGroupService.list({ includeInactive: true }),
    ]);

    const groupMap = buildGroupMap(groups);
    const filtered = vouchers.filter((voucher) => isInPeriod(voucher.date, period));
    const summary = buildDashboardSummaryFromFiltered(filtered, vouchers, ledgers, groupMap);
    return attachStockValue(summary);
  },

  /** Indian FY or any window: `fromYmd` / `toYmd` as `yyyy-mm-dd` (voucher `date` compared inclusively). */
  async summaryForDateRange(fromYmd: string, toYmd: string): Promise<DashboardSummary> {
    const [vouchers, ledgers, groups] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: true }),
      ledgerGroupService.list({ includeInactive: true }),
    ]);
    const groupMap = buildGroupMap(groups);
    const filtered = vouchers.filter((voucher) => isInDateRangeInclusive(voucher.date, fromYmd, toYmd));
    const summary = buildDashboardSummaryFromFiltered(filtered, vouchers, ledgers, groupMap);
    return attachStockValue(summary);
  },

  async salesAnalytics(params: { period: SummaryPeriod; groupBy: 'day' | 'week' | 'month' }): Promise<SalesAnalytics> {
    const [vouchers, items] = await Promise.all([
      voucherService.list(),
      inventoryItemService.list({ includeInactive: true }),
    ]);
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const data = new Map<string, { sales: number; tax: number }>();
    const productTotals = new Map<string, number>();

    vouchers
      .filter((voucher) => isInPeriod(voucher.date, params.period))
      .filter((voucher) => SALES_TYPES.has(voucher.type) || SALES_RETURN_TYPES.has(voucher.type))
      .forEach((voucher) => {
        const key = groupKey(voucher.date, params.groupBy);
        const direction = SALES_TYPES.has(voucher.type) ? 1 : -1;
        const amount = voucherAmount(voucher) * direction;
        const gstLines = voucher.lines?.filter((line) => line.ledgerId && line.credit && line.credit > 0);
        const taxTotal = (gstLines ?? []).reduce((sum, line) => sum + Number(line.credit ?? 0), 0) * direction;

        const current = data.get(key) ?? { sales: 0, tax: 0 };
        current.sales += amount;
        current.tax += taxTotal;
        data.set(key, current);

        (voucher.lines ?? [])
          .filter((line) => line.itemId)
          .forEach((line) => {
            const product = itemMap.get(line.itemId!);
            const name = coalesceName(product?.name, line.itemId);
            const lineValue = lineAmount(line) * direction;
            productTotals.set(name, (productTotals.get(name) ?? 0) + lineValue);
          });
      });

    const analytics: SalesAnalyticsData[] = Array.from(data.entries())
      .map(([date, value]) => ({ date, sales: Number(value.sales.toFixed(2)), tax: Number(value.tax.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topProducts: TopProduct[] = Array.from(productTotals.entries())
      .map(([productName, amount]) => ({ productName, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount);

    return { analytics, topProducts };
  },

  async outstandingSummary(): Promise<{
    customers: CustomerSummary[];
    salesVouchers: AgingSaleVoucher[];
    billReferences: import('../../types/billReference').BillReference[];
  }> {
    const [ledgers, groups, vouchers] = await Promise.all([
      ledgerAccountService.list({ includeInactive: false }),
      ledgerGroupService.list({ includeInactive: true }),
      voucherService.list(),
    ]);
    await billReferenceService.ensureMigrated();
    const billReferences = (await billReferenceService.list()).filter(
      (r) => r.pendingAmount > 0.01 && CUSTOMER_GROUP_IDS.has(
        ledgers.find((l) => l.id === r.partyId)?.groupId ?? ''
      )
    );
    const groupMap = buildGroupMap(groups);
    const ledgerMap = new Map(ledgers.map((ledger) => [ledger.id, ledger]));
    const customers = summarizeLedgers(ledgers, groupMap).customers
      .filter((c) => Number(c.currentBalance) > 0)
      .sort((a, b) => b.currentBalance - a.currentBalance);

    const salesVouchers: AgingSaleVoucher[] = vouchers
      .filter((voucher) => SALES_TYPES.has(voucher.type))
      .map((voucher) => {
        const partyLine = (voucher.lines ?? []).find((line) =>
          CUSTOMER_GROUP_IDS.has(ledgerMap.get(line.ledgerId ?? '')?.groupId ?? '')
        );
        const partyLedgerId = partyLine?.ledgerId ?? '';
        return {
          id: voucher.id,
          invoiceNumber: voucher.number,
          date: voucher.date,
          amount: voucherAmount(voucher),
          partyLedgerId,
        };
      })
      .filter((row) => row.partyLedgerId && row.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    return { customers, salesVouchers, billReferences };
  },

  async payableSummary(): Promise<{
    suppliers: SupplierSummary[];
    billReferences: import('../../types/billReference').BillReference[];
  }> {
    const [ledgers, groups] = await Promise.all([
      ledgerAccountService.list({ includeInactive: false }),
      ledgerGroupService.list({ includeInactive: true }),
    ]);
    await billReferenceService.ensureMigrated();
    const billReferences = (await billReferenceService.list()).filter(
      (r) =>
        r.pendingAmount > 0.01 &&
        SUPPLIER_GROUP_IDS.has(ledgers.find((l) => l.id === r.partyId)?.groupId ?? '')
    );
    const groupMap = buildGroupMap(groups);
    const suppliers = summarizeLedgers(ledgers, groupMap).suppliers
      .sort((a, b) => b.currentBalance - a.currentBalance)
      .slice(0, 10);
    return { suppliers, billReferences };
  },

  async recentTransactions(
    limit = 5,
    options?: { invoicePeriod?: SummaryPeriod }
  ): Promise<RecentTransactions> {
    const [vouchers, ledgers] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: true }),
    ]);
    const ledgerMap = new Map(ledgers.map((ledger) => [ledger.id, ledger]));

    const toInvoice = (voucher: Voucher): RecentTransactions['invoices'][number] => {
      const partyLine = (voucher.lines ?? []).find((line) =>
        CUSTOMER_GROUP_IDS.has(ledgerMap.get(line.ledgerId ?? '')?.groupId ?? '')
      );
      const partyName = partyLine ? ledgerMap.get(partyLine.ledgerId!)?.name ?? '' : '';
      return {
        id: voucher.id,
        invoiceNumber: voucher.number,
        date: voucher.date,
        grandTotal: voucherAmount(voucher),
        paymentStatus: computeSalesInvoicePaymentStatus(voucher, vouchers),
        type: voucher.type,
        partyName,
      };
    };

    const toPayment = (voucher: Voucher): RecentTransactions['payments'][number] => ({
      id: voucher.id,
      type: PAYMENT_TYPES.has(voucher.type) ? 'PAYMENT' : 'RECEIPT',
      date: voucher.date,
      paymentMode: 'Ledger',
      amount: voucherAmount(voucher),
    });

    const toReturn = (voucher: Voucher, isSalesReturn: boolean): RecentReturn => {
      const targetGroups = isSalesReturn ? CUSTOMER_GROUP_IDS : SUPPLIER_GROUP_IDS;
      const partyLine = (voucher.lines ?? []).find((line) => targetGroups.has(ledgerMap.get(line.ledgerId ?? '')?.groupId ?? ''));
      const partyName = partyLine ? ledgerMap.get(partyLine.ledgerId!)?.name ?? '' : '';
      return {
        id: voucher.id,
        number: voucher.number,
        date: voucher.date,
        party: partyName || 'N/A',
        amount: voucherAmount(voucher),
      };
    };

    const sorted = [...vouchers].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    let salesVouchers = sorted.filter((voucher) => SALES_TYPES.has(voucher.type));
    if (options?.invoicePeriod) {
      salesVouchers = salesVouchers.filter((voucher) =>
        isInPeriod(voucher.date, options.invoicePeriod!)
      );
    }

    const invoices = salesVouchers.slice(0, limit).map(toInvoice);
    const payments = sorted
      .filter((voucher) => RECEIPT_TYPES.has(voucher.type) || PAYMENT_TYPES.has(voucher.type))
      .slice(0, limit)
      .map(toPayment);
    const creditNotes = sorted.filter((voucher) => SALES_RETURN_TYPES.has(voucher.type)).slice(0, limit).map((voucher) => toReturn(voucher, true));
    const debitNotes = sorted.filter((voucher) => PURCHASE_RETURN_TYPES.has(voucher.type)).slice(0, limit).map((voucher) => toReturn(voucher, false));

    return { invoices, payments, creditNotes, debitNotes };
  },

  async gstSnapshot(period: SummaryPeriod): Promise<GstSnapshot> {
    const [vouchers, ledgers] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: true }),
    ]);
    const ledgerMap = new Map(ledgers.map((ledger) => [ledger.id, ledger]));

    let output = 0;
    let input = 0;

    vouchers
      .filter((voucher) => isInPeriod(voucher.date, period))
      .forEach((voucher) => {
        const gstMode = gstDirectionForVoucher(voucher.type);
        if (!gstMode) return;

        const direction = SALES_TYPES.has(voucher.type)
          ? 1
          : SALES_RETURN_TYPES.has(voucher.type)
          ? -1
          : PURCHASE_TYPES.has(voucher.type)
          ? 1
          : PURCHASE_RETURN_TYPES.has(voucher.type)
          ? -1
          : 0;

        if (direction === 0) return;
        const explicitTaxTotal = (voucher.lines ?? []).reduce(
          (sum, line) => sum + Number(line.cgstAmount || 0) + Number(line.sgstAmount || 0) + Number(line.igstAmount || 0),
          0
        );

        const validLedgerIds = gstMode === 'output' ? OUTPUT_GST_LEDGER_IDS : INPUT_GST_LEDGER_IDS;
        const fallbackGstLedgerTotal = (voucher.lines ?? []).reduce((sum, line) => {
          const lineLedgerId = String(line.ledgerId || '');
          if (validLedgerIds.has(lineLedgerId)) return sum + Number(lineAmount(line));
          // fallback for legacy ledgers only when explicitly under duties/taxes and GST-like
          const ledger = ledgerMap.get(lineLedgerId);
          const isGstTaxLedger = ledger?.groupId === GST_GROUP_ID && looksLikeGstLedger(ledger, line);
          if (!isGstTaxLedger) return sum;
          const token = `${String(ledger?.name || '').toLowerCase()} ${lineLedgerId.toLowerCase()}`;
          if (gstMode === 'output' && token.includes('input')) return sum;
          if (gstMode === 'input' && token.includes('output')) return sum;
          return sum + Number(lineAmount(line));
        }, 0);

        const taxBase = explicitTaxTotal > 0 ? explicitTaxTotal : fallbackGstLedgerTotal;
        if (taxBase <= 0) return;
        const total = taxBase * direction;

        if (SALES_TYPES.has(voucher.type) || SALES_RETURN_TYPES.has(voucher.type)) {
          output += total;
        } else {
          input += total;
        }
      });

    const netOutput = Math.max(0, output);
    const netInput = Math.max(0, input);
    const net = netOutput - netInput;

    return {
      outputGst: Number(netOutput.toFixed(2)),
      inputItc: Number(netInput.toFixed(2)),
      payable: net > 0 ? Number(net.toFixed(2)) : 0,
      receivable: net < 0 ? Number(Math.abs(net).toFixed(2)) : 0,
    };
  },

  async gstSnapshotForDateRange(fromYmd: string, toYmd: string): Promise<GstSnapshot> {
    const [vouchers, ledgers] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: true }),
    ]);
    const ledgerMap = new Map(ledgers.map((ledger) => [ledger.id, ledger]));

    let output = 0;
    let input = 0;

    vouchers
      .filter((voucher) => isInDateRangeInclusive(voucher.date, fromYmd, toYmd))
      .forEach((voucher) => {
        const gstMode = gstDirectionForVoucher(voucher.type);
        if (!gstMode) return;

        const direction = SALES_TYPES.has(voucher.type)
          ? 1
          : SALES_RETURN_TYPES.has(voucher.type)
          ? -1
          : PURCHASE_TYPES.has(voucher.type)
          ? 1
          : PURCHASE_RETURN_TYPES.has(voucher.type)
          ? -1
          : 0;

        if (direction === 0) return;
        const explicitTaxTotal = (voucher.lines ?? []).reduce(
          (sum, line) => sum + Number(line.cgstAmount || 0) + Number(line.sgstAmount || 0) + Number(line.igstAmount || 0),
          0
        );

        const validLedgerIds = gstMode === 'output' ? OUTPUT_GST_LEDGER_IDS : INPUT_GST_LEDGER_IDS;
        const fallbackGstLedgerTotal = (voucher.lines ?? []).reduce((sum, line) => {
          const lineLedgerId = String(line.ledgerId || '');
          if (validLedgerIds.has(lineLedgerId)) return sum + Number(lineAmount(line));
          const ledger = ledgerMap.get(lineLedgerId);
          const isGstTaxLedger = ledger?.groupId === GST_GROUP_ID && looksLikeGstLedger(ledger, line);
          if (!isGstTaxLedger) return sum;
          const token = `${String(ledger?.name || '').toLowerCase()} ${lineLedgerId.toLowerCase()}`;
          if (gstMode === 'output' && token.includes('input')) return sum;
          if (gstMode === 'input' && token.includes('output')) return sum;
          return sum + Number(lineAmount(line));
        }, 0);

        const taxBase = explicitTaxTotal > 0 ? explicitTaxTotal : fallbackGstLedgerTotal;
        if (taxBase <= 0) return;
        const total = taxBase * direction;

        if (SALES_TYPES.has(voucher.type) || SALES_RETURN_TYPES.has(voucher.type)) {
          output += total;
        } else {
          input += total;
        }
      });

    const netOutput = Math.max(0, output);
    const netInput = Math.max(0, input);
    const net = netOutput - netInput;

    return {
      outputGst: Number(netOutput.toFixed(2)),
      inputItc: Number(netInput.toFixed(2)),
      payable: net > 0 ? Number(net.toFixed(2)) : 0,
      receivable: net < 0 ? Number(Math.abs(net).toFixed(2)) : 0,
    };
  },

  async lowStock(): Promise<LowStockItem[]> {
    const items = await inventoryItemService.list({ includeInactive: false });
    return listLowStockItems(items).map((row) => ({
      id: row.id,
      name: row.name,
      currentStock: Number(row.currentStock.toFixed(2)),
      reorderLevel: row.threshold,
      requiredQuantity: Number(row.reorderQty.toFixed(2)),
      supplier: row.brand?.trim() || '—',
    }));
  },
};
