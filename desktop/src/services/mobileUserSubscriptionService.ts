import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/firebase';

function requireFunctions() {
  if (!functions) throw new Error('Firebase not configured');
  return functions;
}

export type MobileUserRecord = {
  id: string;
  userEmail?: string;
  mobileNumber?: string;
  displayName?: string;
  status?: string;
  validUntil?: number | string | null;
  validUntilMs?: number | null;
  deviceId?: string | null;
  deviceKey?: string | null;
  pinHash?: string;
  transferPending?: boolean;
  licenseKey?: string;
};

function toValidUntilMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 1_000_000_000_000) return n;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function mapMobileUserForEntitlements(item: MobileUserRecord & Record<string, unknown>) {
  const validUntilMs =
    item.validUntilMs != null
      ? Number(item.validUntilMs)
      : toValidUntilMs(item.validUntil) ?? toValidUntilMs((item as any).validUntilIso);
  return {
    id: String(item.id),
    licenseKey: String(item.licenseKey || '').toUpperCase(),
    userEmail: String(item.userEmail || '').toLowerCase(),
    mobileNumber: String(item.mobileNumber || ''),
    displayName: String(item.displayName || item.userEmail || ''),
    status: String(item.status || 'active'),
    validUntilMs,
    deviceId: item.deviceId ? String(item.deviceId) : null,
    deviceKey: item.deviceKey ? String(item.deviceKey) : null,
    pinHash: String(item.pinHash || ''),
  };
}

export async function callSubmitMobileUserSubscription(params: {
  licenseKey?: string;
  userEmail: string;
  mobileNumber: string;
  displayName?: string;
  utr: string;
}) {
  const fn = httpsCallable(requireFunctions(), 'submitMobileUserSubscription');
  const res = await fn(params);
  return res.data as { ok: boolean; requestId?: string };
}

export async function callGetMyMobileUserRequests(params?: { licenseKey?: string }) {
  const fn = httpsCallable(requireFunctions(), 'getMyMobileUserRequests');
  const res = await fn({ licenseKey: params?.licenseKey ?? '' });
  return res.data as { ok: boolean; items: Array<{ id: string; [k: string]: unknown }> };
}

export async function callListMobileUsersForLicense(params?: { licenseKey?: string }) {
  const fn = httpsCallable(requireFunctions(), 'listMobileUsersForLicense');
  const res = await fn({ licenseKey: params?.licenseKey ?? '' });
  return res.data as { ok: boolean; items: Array<MobileUserRecord & Record<string, unknown>> };
}

export async function callTransferMobileUserDevice(params: { userId: string }) {
  const fn = httpsCallable(requireFunctions(), 'transferMobileUserDevice');
  const res = await fn(params);
  return res.data as { ok: boolean };
}

export async function callRegisterMobileUserDevice(params: { userId: string; deviceId: string }) {
  const fn = httpsCallable(requireFunctions(), 'registerMobileUserDevice');
  const res = await fn(params);
  return res.data as { ok: boolean };
}

export async function syncMobileEntitlementsToDesktop(items: Array<MobileUserRecord & Record<string, unknown>>) {
  const users = items.map(mapMobileUserForEntitlements).filter((u) => u.pinHash && u.id);
  const payload = { users, syncedAt: new Date().toISOString() };
  if (typeof window !== 'undefined' && window.electronAPI?.mobileEntitlementsSync) {
    await window.electronAPI.mobileEntitlementsSync(payload);
  }
  return payload;
}

export async function refreshAndSyncMobileEntitlements(licenseKey?: string) {
  const data = await callListMobileUsersForLicense({ licenseKey });
  return syncMobileEntitlementsToDesktop(data.items ?? []);
}
