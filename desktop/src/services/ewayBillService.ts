import type {
  EwayBillFormValues,
  EwayBillStatus,
  TransportMode,
  VoucherEwayBill,
} from '../types/ewayBill';
import { DEFAULT_EWAY_THRESHOLD } from '../types/ewayBill';
import type { Voucher } from '../types/vouchers';
import { voucherGrandTotal } from './voucherPrintBuilder';
import { loadEwayBillSettings } from './ewayBillSettingsService';
import { voucherService } from './vouchers/voucherService';

export interface EwayBillApiResult {
  ok: boolean;
  ewayBillNo?: string;
  message: string;
}

export interface EwayBillDashboardStats {
  pending: number;
  generated: number;
  thisMonth: number;
}

export function isEwayThresholdExceeded(
  grandTotal: number,
  threshold = loadEwayBillSettings().thresholdAmount
): boolean {
  return Number(grandTotal) >= Number(threshold || DEFAULT_EWAY_THRESHOLD);
}

export function shouldShowEwayReminder(grandTotal: number): boolean {
  const settings = loadEwayBillSettings();
  if (!settings.showReminderPopup || !settings.askAboveThreshold) return false;
  return isEwayThresholdExceeded(grandTotal, settings.thresholdAmount);
}

export function resolveInitialEwayStatus(grandTotal: number): EwayBillStatus {
  const threshold = loadEwayBillSettings().thresholdAmount;
  return isEwayThresholdExceeded(grandTotal, threshold) ? 'PENDING' : 'NOT_REQUIRED';
}

export function emptyEwayFormValues(): EwayBillFormValues {
  return {
    ewayBillNo: '',
    transporterName: '',
    transporterGstin: '',
    vehicleNo: '',
    transportMode: 'Road',
    dispatchFrom: '',
    dispatchTo: '',
    distanceKm: '',
    remarks: '',
  };
}

export function ewayBillToFormValues(eway?: VoucherEwayBill | null): EwayBillFormValues {
  if (!eway) return emptyEwayFormValues();
  return {
    ewayBillNo: eway.ewayBillNo ?? '',
    transporterName: eway.transporterName ?? '',
    transporterGstin: eway.transporterGstin ?? '',
    vehicleNo: eway.vehicleNo ?? '',
    transportMode: eway.transportMode ?? 'Road',
    dispatchFrom: eway.dispatchFrom ?? '',
    dispatchTo: eway.dispatchTo ?? '',
    distanceKm: eway.distanceKm != null ? String(eway.distanceKm) : '',
    remarks: eway.remarks ?? '',
  };
}

export function formValuesToEwayBill(
  values: EwayBillFormValues,
  grandTotal: number,
  existingStatus?: EwayBillStatus
): VoucherEwayBill {
  const distance = values.distanceKm.trim() ? Number(values.distanceKm) : undefined;
  const hasDetails =
    values.ewayBillNo.trim() ||
    values.transporterName.trim() ||
    values.vehicleNo.trim() ||
    values.transporterGstin.trim();

  let status: EwayBillStatus;
  if (!isEwayThresholdExceeded(grandTotal)) {
    status = 'NOT_REQUIRED';
  } else if (values.ewayBillNo.trim()) {
    status = existingStatus === 'GENERATED' ? 'GENERATED' : 'MANUAL';
  } else if (hasDetails) {
    status = 'MANUAL';
  } else if (existingStatus && existingStatus !== 'NOT_REQUIRED') {
    status = existingStatus;
  } else {
    status = 'PENDING';
  }

  return {
    ewayBillNo: values.ewayBillNo.trim() || undefined,
    ewayBillDate: new Date().toISOString().slice(0, 10),
    transporterName: values.transporterName.trim() || undefined,
    transporterGstin: values.transporterGstin.trim() || undefined,
    vehicleNo: values.vehicleNo.trim() || undefined,
    transportMode: values.transportMode as TransportMode,
    dispatchFrom: values.dispatchFrom.trim() || undefined,
    dispatchTo: values.dispatchTo.trim() || undefined,
    distanceKm: Number.isFinite(distance) ? distance : undefined,
    remarks: values.remarks.trim() || undefined,
    status,
  };
}

export function buildEwayBillForSkipSave(grandTotal: number): VoucherEwayBill {
  return { status: resolveInitialEwayStatus(grandTotal) };
}

export function getEwayStatusLabel(status?: EwayBillStatus): string {
  switch (status) {
    case 'GENERATED':
      return 'Generated';
    case 'MANUAL':
      return 'Manual';
    case 'PENDING':
      return 'Pending';
    case 'NOT_REQUIRED':
    default:
      return 'Not Required';
  }
}

export function getEwayListDisplay(eway?: VoucherEwayBill | null): string {
  if (!eway) return 'Not Required';
  if (eway.ewayBillNo) return `EWB: ${eway.ewayBillNo}`;
  return getEwayStatusLabel(eway.status);
}

export function hasPrintableEway(eway?: VoucherEwayBill | null): boolean {
  if (!eway || eway.status === 'NOT_REQUIRED' || eway.status === 'PENDING') return false;
  return Boolean(
    eway.ewayBillNo ||
      eway.transporterName ||
      eway.vehicleNo ||
      eway.transportMode ||
      eway.distanceKm
  );
}

export function buildEwayPrintBlock(eway?: VoucherEwayBill | null): string {
  if (!hasPrintableEway(eway)) return '';
  const rows = [
    eway?.ewayBillNo ? `<tr><td>E-Way Bill No.</td><td>${escapeHtml(eway.ewayBillNo)}</td></tr>` : '',
    eway?.vehicleNo ? `<tr><td>Vehicle No.</td><td>${escapeHtml(eway.vehicleNo)}</td></tr>` : '',
    eway?.transporterName
      ? `<tr><td>Transporter</td><td>${escapeHtml(eway.transporterName)}</td></tr>`
      : '',
    eway?.transportMode
      ? `<tr><td>Transport Mode</td><td>${escapeHtml(eway.transportMode)}</td></tr>`
      : '',
    eway?.distanceKm != null
      ? `<tr><td>Distance</td><td>${escapeHtml(String(eway.distanceKm))} KM</td></tr>`
      : '',
  ].filter(Boolean);
  if (!rows.length) return '';
  return `<div class="section"><strong>E-Way Bill</strong><table class="totals">${rows.join('')}</table></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function computeEwayBillDashboardStats(): Promise<EwayBillDashboardStats> {
  const vouchers = await voucherService.list();
  const sales = vouchers.filter((v) => v.type === 'SALES' && v.status !== 'CANCELLED');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let pending = 0;
  let generated = 0;
  let thisMonth = 0;

  for (const v of sales) {
    const eway = v.ewayBill;
    const invDate = new Date(v.date);
    const inMonth = invDate >= monthStart;

    if (eway?.status === 'PENDING') pending += 1;
    if (eway?.status === 'MANUAL' || eway?.status === 'GENERATED') generated += 1;
    if (inMonth && eway && eway.status !== 'NOT_REQUIRED') thisMonth += 1;
  }

  return { pending, generated, thisMonth };
}

export async function listEwayEligibleInvoices(): Promise<
  Array<{ voucher: Voucher; grandTotal: number; eway?: VoucherEwayBill }>
> {
  const vouchers = await voucherService.list();
  return vouchers
    .filter((v) => v.type === 'SALES' && v.status !== 'CANCELLED')
    .map((v) => ({
      voucher: v,
      grandTotal: voucherGrandTotal(v),
      eway: v.ewayBill,
    }))
    .sort((a, b) => b.voucher.date.localeCompare(a.voucher.date));
}

export async function patchVoucherEwayBill(
  voucherId: string,
  ewayBill: VoucherEwayBill
): Promise<void> {
  const voucher = await voucherService.getById(voucherId);
  if (!voucher || voucher.type !== 'SALES') {
    throw new Error('Sales invoice not found');
  }
  await voucherService.update(voucherId, {
    type: voucher.type,
    date: voucher.date,
    number: voucher.number,
    narration: voucher.narration,
    lines: voucher.lines,
    ewayBill,
  });
}

export function buildEwayPrintDocumentHtml(
  invoiceNumber: string,
  customerName: string,
  eway: VoucherEwayBill
): string {
  const block = buildEwayPrintBlock(eway);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E-Way Bill ${invoiceNumber}</title>
  <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111827}table{border-collapse:collapse;width:100%;max-width:640px}td,th{border:1px solid #d1d5db;padding:8px}th{text-align:left;background:#eef4fb}</style>
  </head><body><h2>E-Way Bill Details</h2><p><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</p><p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>${block}</body></html>`;
}

/** TODO: Integrate Masters India / ClearTax / Vayana GSP API. */
export async function generateEWB(invoiceId: string): Promise<EwayBillApiResult> {
  const settings = loadEwayBillSettings();
  if (settings.autoGenerateFuture) {
    // TODO: Call configured GSP provider when enabled.
  }
  return {
    ok: true,
    ewayBillNo: `EWB${Date.now()}`,
    message: 'Mock E-Way Bill generated. Connect GSP provider in a future release.',
  };
}

/** TODO: Cancel E-Way Bill via GSP API. */
export async function cancelEWB(_ewayBillNo: string): Promise<EwayBillApiResult> {
  return { ok: true, message: 'Mock cancel — GSP integration pending.' };
}

/** TODO: Poll E-Way Bill status from GSP API. */
export async function getEWBStatus(ewayBillNo: string): Promise<EwayBillApiResult> {
  return { ok: true, ewayBillNo, message: 'Mock status — GSP integration pending.' };
}

/** TODO: Extend E-Way Bill validity via GSP API. */
export async function extendEWB(_ewayBillNo: string): Promise<EwayBillApiResult> {
  return { ok: true, message: 'Mock extend — GSP integration pending.' };
}
