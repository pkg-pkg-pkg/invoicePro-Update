import { httpsCallable } from 'firebase/functions';
import { collection, collectionGroup, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { functions, db } from '../firebase/firebase';
import type { LicenseRecord } from '../utils/licenseHelpers';

function serializeValue(v: unknown): unknown {
  if (v == null) return v;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof (v as { toMillis?: () => number })?.toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof (v as { toDate?: () => Date })?.toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = serializeValue(val);
    }
    return out;
  }
  return v;
}

const INTERNAL_HINT =
  'Cloud Function crashed or is not deployed. Check Firebase Console → Functions → Logs. Deploy: `cd desktop && firebase deploy --only functions --project invoicepro-105ba`. Set secret: `firebase functions:secrets:set LICENSE_SECRET` (or `firebase functions:config:set license.secret="..."`). Ensure your UID exists in Firestore `admins/{uid}`.';

export function formatCallableError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  const code = String(err?.code ?? '').replace(/^functions\//, '');
  const msg = String(err?.message ?? '').trim();
  if (code === 'internal' || msg.toLowerCase() === 'internal') {
    return `code=functions/internal | message=internal — ${INTERNAL_HINT}`;
  }
  if (code === 'unavailable' || msg.toLowerCase() === 'unavailable') {
    return `code=functions/unavailable | message=unavailable — Functions not reachable. Deploy functions, check billing/APIs, and retry in a minute.`;
  }
  if (code && msg && msg !== 'internal') return `code=functions/${code} | message=${msg}`;
  if (msg) return msg;
  if (code) return `code=functions/${code}`;
  return 'Request failed';
}

async function call<T>(name: string, data?: Record<string, unknown>): Promise<T> {
  try {
    const fn = httpsCallable(functions, name);
    const res = await fn(data ?? {});
    return res.data as T;
  } catch (e: unknown) {
    throw new Error(formatCallableError(e));
  }
}

async function listLicensesFromFirestore(max = 500): Promise<LicenseRecord[]> {
  const qs = await getDocs(query(collection(db, 'licenses'), limit(max)));
  return qs.docs.map((d) => {
    const raw = serializeValue(d.data()) as Record<string, unknown>;
    return {
      id: d.id,
      licenseKey: d.id,
      ...raw,
    } as LicenseRecord;
  });
}

export async function becomeAdmin(): Promise<{ ok: boolean }> {
  return call('becomeAdmin');
}

export async function generateLicense(input: {
  maxActivations: number;
  validityDays?: number | null;
  note?: string;
  customKey?: string;
}): Promise<{ ok: boolean; licenseKey: string }> {
  return call('generateLicense', input as Record<string, unknown>);
}

/** Cloud Function first; falls back to Firestore list (admin rules) if callable fails. */
export async function listLicenses(pageSize = 200): Promise<LicenseRecord[]> {
  const capped = Math.min(Math.max(pageSize, 1), 500);
  try {
    const res = await call<{ ok: boolean; items: LicenseRecord[] }>('listLicenses', { pageSize: Math.min(capped, 200) });
    return (res.items ?? []).map((item) => ({
      ...item,
      id: item.id || item.licenseKey || '',
    }));
  } catch {
    return listLicensesFromFirestore(capped);
  }
}

export async function revokeLicense(licenseKey: string): Promise<{ ok: boolean }> {
  return call('revokeLicense', { licenseKey });
}

export async function updateLicenseAdmin(
  licenseKey: string,
  patch: Record<string, unknown>
): Promise<{ ok: boolean }> {
  return call('updateLicenseAdmin', { licenseKey, ...patch });
}

export async function listUsers(pageSize = 500): Promise<Array<{ id: string; [k: string]: unknown }>> {
  try {
    const res = await call<{ ok: boolean; items: Array<{ id: string; [k: string]: unknown }> }>('listUsers', {
      pageSize: Math.min(pageSize, 500),
    });
    return res.items ?? [];
  } catch {
    const qs = await getDocs(query(collection(db, 'users'), limit(Math.min(pageSize, 500))));
    return qs.docs.map((d) => ({ id: d.id, ...(serializeValue(d.data()) as Record<string, unknown>) }));
  }
}

async function listAuditEventsFromFirestore(limitN: number): Promise<Array<{ id: string; [k: string]: unknown }>> {
  const capped = Math.min(Math.max(limitN, 1), 500);
  try {
    const snap = await getDocs(
      query(collectionGroup(db, 'events'), orderBy('createdAt', 'desc'), limit(capped))
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(serializeValue(d.data()) as Record<string, unknown>),
    }));
  } catch {
    const parents = await getDocs(collection(db, 'license_audit'));
    const items: Array<{ id: string; [k: string]: unknown }> = [];
    for (const p of parents.docs) {
      const evSnap = await getDocs(
        query(collection(db, 'license_audit', p.id, 'events'), limit(Math.min(capped, 100)))
      );
      for (const ev of evSnap.docs) {
        items.push({
          id: ev.id,
          ...(serializeValue(ev.data()) as Record<string, unknown>),
        });
      }
    }
    items.sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return items.slice(0, capped);
  }
}

export async function listAuditEvents(limitN = 100): Promise<Array<{ id: string; [k: string]: unknown }>> {
  try {
    const res = await call<{ ok: boolean; items: Array<{ id: string; [k: string]: unknown }> }>('listAuditEvents', {
      limit: limitN,
    });
    return res.items ?? [];
  } catch {
    return listAuditEventsFromFirestore(limitN);
  }
}

export async function listMultiUserUpgradeRequests(status = ''): Promise<
  Array<{ id: string; [k: string]: unknown }>
> {
  try {
    const res = await call<{ ok: boolean; items: Array<{ id: string; [k: string]: unknown }> }>(
      'listMultiUserUpgradeRequests',
      status ? { status } : {}
    );
    return res.items ?? [];
  } catch {
    const capped = 200;
    const qs = await getDocs(query(collection(db, 'license_upgrade_requests'), limit(capped)));
    let items: Array<{ id: string; [k: string]: unknown }> = qs.docs.map((d) => ({
      id: d.id,
      ...(serializeValue(d.data()) as Record<string, unknown>),
    }));
    if (status) {
      items = items.filter((r) => String(r.status ?? '') === status);
    }
    items.sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return items;
  }
}

export async function approveMultiUserUpgradeRequest(requestId: string): Promise<{ ok: boolean }> {
  return call('approveMultiUserUpgradeRequest', { requestId });
}

export async function rejectMultiUserUpgradeRequest(requestId: string, reason?: string): Promise<{ ok: boolean }> {
  return call('rejectMultiUserUpgradeRequest', { requestId, reason });
}

export async function listGatewayRenewalRequests(status = ''): Promise<
  Array<{ id: string; [k: string]: unknown }>
> {
  try {
    const res = await call<{ ok: boolean; items: Array<{ id: string; [k: string]: unknown }> }>(
      'listGatewayRenewalRequests',
      status ? { status } : {}
    );
    return res.items ?? [];
  } catch {
    const capped = 200;
    const qs = await getDocs(query(collection(db, 'gateway_renewal_requests'), limit(capped)));
    let items: Array<{ id: string; [k: string]: unknown }> = qs.docs.map((d) => ({
      id: d.id,
      ...(serializeValue(d.data()) as Record<string, unknown>),
    }));
    if (status) {
      items = items.filter((r) => String(r.status ?? '') === status);
    }
    items.sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return items;
  }
}

export async function approveGatewayRenewalRequest(requestId: string): Promise<{ ok: boolean }> {
  return call('approveGatewayRenewalRequest', { requestId });
}

export async function rejectGatewayRenewalRequest(requestId: string, reason?: string): Promise<{ ok: boolean }> {
  return call('rejectGatewayRenewalRequest', { requestId, reason });
}

export async function listMobileUserRequests(status = ''): Promise<Array<{ id: string; [k: string]: unknown }>> {
  try {
    const res = await call<{ ok: boolean; items: Array<{ id: string; [k: string]: unknown }> }>(
      'listMobileUserRequests',
      status ? { status } : {}
    );
    return res.items ?? [];
  } catch {
    const capped = 200;
    const qs = await getDocs(query(collection(db, 'mobile_user_requests'), limit(capped)));
    let items: Array<{ id: string; [k: string]: unknown }> = qs.docs.map((d) => ({
      id: d.id,
      ...(serializeValue(d.data()) as Record<string, unknown>),
    }));
    if (status) items = items.filter((r) => String(r.status ?? '') === status);
    items.sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return items;
  }
}

export async function listMobileUsersAdmin(): Promise<Array<{ id: string; [k: string]: unknown }>> {
  const res = await call<{ ok: boolean; items: Array<{ id: string; [k: string]: unknown }> }>(
    'listMobileUsersAdmin',
    {}
  );
  return res.items ?? [];
}

export async function approveMobileUserRequest(requestId: string): Promise<{ ok: boolean; initialPin?: string }> {
  return call('approveMobileUserRequest', { requestId });
}

export async function rejectMobileUserRequest(requestId: string, reason?: string): Promise<{ ok: boolean }> {
  return call('rejectMobileUserRequest', { requestId, reason });
}

export async function transferMobileUserDevice(userId: string): Promise<{ ok: boolean }> {
  return call('transferMobileUserDevice', { userId });
}
