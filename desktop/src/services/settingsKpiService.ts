import { customersApi } from './customers/customersApi';
import { dashboardAggregator } from './dashboard/dashboardAggregator';
import { inventoryItemService } from './masters/inventoryItemService';
import { voucherService } from './vouchers/voucherService';

export interface SettingsKpis {
  totalCustomers: number;
  totalItems: number;
  totalInvoices: number;
  outstandingAmount: number;
  bankBalance: number;
}

export async function loadSettingsKpis(): Promise<SettingsKpis> {
  try {
    const [customers, items, vouchers, summary] = await Promise.all([
      customersApi.list('ALL'),
      inventoryItemService.list({ includeInactive: false }),
      voucherService.list(),
      dashboardAggregator.summary('year'),
    ]);

    const activeItems = items.filter((i) => i.status === 'ACTIVE').length;
    const salesInvoices = vouchers.filter((v) => v.type === 'SALES').length;

    return {
      totalCustomers: customers.length,
      totalItems: activeItems,
      totalInvoices: salesInvoices,
      outstandingAmount: Number(summary.totalOutstanding ?? 0),
      bankBalance: Number((summary.bankBalance ?? 0) + (summary.cashInHand ?? 0)),
    };
  } catch {
    return {
      totalCustomers: 0,
      totalItems: 0,
      totalInvoices: 0,
      outstandingAmount: 0,
      bankBalance: 0,
    };
  }
}
