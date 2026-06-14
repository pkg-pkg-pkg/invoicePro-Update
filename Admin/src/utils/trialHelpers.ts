import type { Timestamp } from 'firebase/firestore';

export type TrialLocation = {
  city?: string;
  state?: string;
  final_pincode?: string;
  pincode?: string;
};

export type TrialRecord = {
  id: string;
  mobile_no: string;
  otp_verified?: boolean;
  trial_start_date?: Timestamp | null;
  trial_end_date?: Timestamp | null;
  created_at?: Timestamp | null;
  days_remaining?: number;
  login_count?: number;
  device_id?: string;
  is_expired?: boolean;
  converted_to_paid?: boolean;
  block_reason?: string;
  location?: TrialLocation;
};

export function tsToMs(ts: Timestamp | null | undefined): number | null {
  if (!ts || typeof ts.toMillis !== 'function') return null;
  const ms = ts.toMillis();
  return Number.isFinite(ms) ? ms : null;
}

export function formatTrialDate(ts: Timestamp | null | undefined): string {
  const ms = tsToMs(ts);
  if (ms == null) return '—';
  return new Date(ms).toLocaleDateString('en-IN');
}

export function maskTrialMobile(mobile: string): string {
  const m = String(mobile ?? '').replace(/\D/g, '').slice(-10);
  if (m.length !== 10) return m;
  return `${m.slice(0, 2)}XXXX${m.slice(6)}`;
}

export function trialStatus(row: TrialRecord): 'Active' | 'Expired' | 'Converted' {
  if (row.converted_to_paid) return 'Converted';
  const endMs = tsToMs(row.trial_end_date);
  if (row.is_expired || (endMs != null && Date.now() >= endMs)) return 'Expired';
  return 'Active';
}

export function daysLeft(row: TrialRecord): number {
  if (row.converted_to_paid) return 0;
  const endMs = tsToMs(row.trial_end_date);
  if (endMs == null) return Number(row.days_remaining ?? 0);
  return Math.max(0, Math.ceil((endMs - Date.now()) / 86400000));
}

export function deviceTail(deviceId?: string): string {
  const id = String(deviceId ?? '');
  if (!id) return '—';
  return id.length <= 8 ? id : id.slice(-8);
}

export function exportTrialsCsv(rows: TrialRecord[]): void {
  const header = [
    'mobile',
    'city',
    'state',
    'pincode',
    'start',
    'end',
    'status',
    'login_count',
    'device',
  ];
  const lines = rows.map((r) => {
    const pin = r.location?.final_pincode || r.location?.pincode || '';
    const status = trialStatus(r);
    return [
      r.mobile_no,
      r.location?.city ?? '',
      r.location?.state ?? '',
      pin,
      formatTrialDate(r.trial_start_date),
      formatTrialDate(r.trial_end_date),
      status,
      String(r.login_count ?? 0),
      r.device_id ?? '',
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',');
  });
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trials-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
