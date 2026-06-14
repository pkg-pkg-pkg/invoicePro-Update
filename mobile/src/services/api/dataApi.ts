import type {
  DashboardSummary,
  DayBookResponse,
  GstReportResponse,
  ItemRecord,
  LedgerAccount,
  PartyRecord,
  ReportResponse,
  VoucherRecord,
} from '../../types/domain';
import { invoiceProClient } from './invoiceProClient';

export async function apiGetDashboardSummary(): Promise<DashboardSummary> {
  const res = await invoiceProClient.get<DashboardSummary>('/api/dashboard/summary');
  return res.data;
}

export async function apiGetItems(): Promise<ItemRecord[]> {
  const res = await invoiceProClient.get<ItemRecord[]>('/api/items');
  return res.data;
}

export async function apiCreateItem(body: Record<string, unknown>): Promise<ItemRecord> {
  const res = await invoiceProClient.post<ItemRecord>('/api/items', body);
  return res.data;
}

export async function apiUpdateItem(id: string, body: Record<string, unknown>): Promise<ItemRecord> {
  const res = await invoiceProClient.put<ItemRecord>(`/api/items/${id}`, body);
  return res.data;
}

export async function apiGetParties(type: 'customer' | 'supplier' | 'all' = 'customer'): Promise<PartyRecord[]> {
  const res = await invoiceProClient.get<PartyRecord[]>('/api/parties', { params: { type } });
  return res.data;
}

export async function apiCreateParty(body: Record<string, unknown>): Promise<PartyRecord> {
  const res = await invoiceProClient.post<PartyRecord>('/api/parties', body);
  return res.data;
}

export async function apiGetPartyLedger(partyId: string): Promise<Record<string, unknown>[]> {
  const res = await invoiceProClient.get<Record<string, unknown>[]>(`/api/parties/${partyId}/ledger`);
  return res.data;
}

export async function apiGetVouchers(type?: string): Promise<VoucherRecord[]> {
  const res = await invoiceProClient.get<VoucherRecord[]>('/api/vouchers', {
    params: type ? { type } : undefined,
  });
  return res.data;
}

export async function apiCreateVoucher(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await invoiceProClient.post<Record<string, unknown>>('/api/vouchers', body);
  return res.data;
}

export async function apiGetLedgers(): Promise<LedgerAccount[]> {
  const res = await invoiceProClient.get<LedgerAccount[]>('/api/ledgers');
  return res.data;
}

export async function apiGetDayBook(params: Record<string, string | boolean | undefined>): Promise<DayBookResponse> {
  const res = await invoiceProClient.get<DayBookResponse>('/api/daybook', { params });
  return res.data;
}

export async function apiGetReport(path: string, params?: Record<string, string | undefined>): Promise<ReportResponse> {
  const res = await invoiceProClient.get<ReportResponse>(`/api/reports/${path}`, { params });
  return res.data;
}

export async function apiGetGstReport(
  path: string,
  params?: Record<string, string | undefined>
): Promise<GstReportResponse> {
  const res = await invoiceProClient.get<GstReportResponse>(`/api/gst/${path}`, { params });
  return res.data;
}
