import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase/firebase';
import { isElectronRuntime } from '../utils/runtime';

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

async function invokeCallable<T>(name: string, data: unknown): Promise<T> {
  if (isElectronRuntime() && window.electronAPI?.firebaseCallable) {
    const user = auth?.currentUser;
    if (!user) throw new Error('Sign in required');
    const idToken = await user.getIdToken();
    const res = await window.electronAPI.firebaseCallable({ name, data, idToken });
    if (!res?.ok) throw new Error(res?.error || 'Cloud function call failed');
    return res.result as T;
  }
  const fn = httpsCallable(requireFunctions(), name);
  const res = await fn(data);
  return res.data as T;
}

export async function callSubmitMobileUserSubscription(params: {
  licenseKey?: string;
  userEmail: string;
  mobileNumber: string;
  displayName?: string;
  utr: string;
}) {
  return invokeCallable<{ ok: boolean; requestId?: string }>('submitMobileUserSubscription', params);
}

export async function callGetMyMobileUserRequests(params?: { licenseKey?: string }) {
  return invokeCallable<{ ok: boolean; items: Array<{ id: string; [k: string]: unknown }> }>(
    'getMyMobileUserRequests',
    { licenseKey: params?.licenseKey ?? '' }
  );
}

export async function callListMobileUsersForLicense(params?: { licenseKey?: string }) {
  return invokeCallable<{ ok: boolean; items: Array<MobileUserRecord & Record<string, unknown>> }>(
    'listMobileUsersForLicense',
    { licenseKey: params?.licenseKey ?? '' }
  );
}

export async function callTransferMobileUserDevice(params: { userId: string }) {
  return invokeCallable<{ ok: boolean }>('transferMobileUserDevice', params);
}

export async function callRegisterMobileUserDevice(params: { userId: string; deviceId: string }) {
  return invokeCallable<{ ok: boolean }>('registerMobileUserDevice', params);
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
