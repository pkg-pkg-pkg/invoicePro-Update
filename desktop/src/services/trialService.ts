import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  increment,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/firebase';
import { getDeviceId } from './deviceService';
import { getEncryptedItem, setEncryptedItem, removeEncryptedItem } from './secureStorage';

export const TRIAL_CACHE_KEY = 'trial_cache_v1';
export const IS_TRIAL_USER_KEY = 'is_trial_user';
export const TRIAL_LAST_VALIDATED_KEY = 'trial_last_validated';

export type TrialCache = {
  mobile_no: string;
  device_id: string;
  trial_end_timestamp: number;
  cached_at: number;
  days_remaining: number;
  status: 'VALID' | 'EXPIRED';
  city: string;
  state: string;
  phone_uid?: string;
};

export type TrialDoc = {
  mobile_no: string;
  otp_verified: boolean;
  phone_uid?: string;
  trial_start_date?: Timestamp;
  trial_end_date?: Timestamp;
  device_id?: string;
  device_name?: string;
  is_expired?: boolean;
  days_remaining?: number;
  converted_to_paid?: boolean;
  block_reason?: string;
  location?: { city?: string; state?: string; final_pincode?: string };
  login_count?: number;
};

export type ValidateTrialResult = {
  status: 'VALID' | 'EXPIRED' | 'DEVICE_BLOCKED' | 'COMPANY_BLOCKED' | 'NEW_USER' | 'MOBILE_BLOCKED';
  message?: string;
  days_remaining?: number;
  trial_end_date?: { seconds: number };
  mobile_no?: string;
};

const CACHE_MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;

function normalizeMobile(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(-10);
}

function requireFns() {
  if (!functions) throw new Error('Firebase Functions not configured');
  return functions;
}

export function isTrialUserFlag(): boolean {
  try {
    return localStorage.getItem(IS_TRIAL_USER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTrialUserFlag(active: boolean): void {
  if (active) localStorage.setItem(IS_TRIAL_USER_KEY, 'true');
  else localStorage.removeItem(IS_TRIAL_USER_KEY);
}

export async function checkTrialByMobile(mobileNo: string): Promise<TrialDoc | null> {
  if (!db) return null;
  const key = normalizeMobile(mobileNo);
  if (key.length !== 10) return null;
  const snap = await getDoc(doc(db, 'trials', key));
  return snap.exists() ? (snap.data() as TrialDoc) : null;
}

export async function checkTrialByDevice(deviceId: string): Promise<TrialDoc | null> {
  if (!db || !deviceId) return null;
  const byDevice = await getDocs(query(collection(db, 'trials'), where('device_id', '==', deviceId)));
  if (!byDevice.empty) return byDevice.docs[0].data() as TrialDoc;
  const byUsed = await getDocs(query(collection(db, 'trials'), where('devices_used', 'array-contains', deviceId)));
  if (!byUsed.empty) return byUsed.docs[0].data() as TrialDoc;
  return null;
}

export async function createTrialRecord(params: {
  mobile_no: string;
  phone_uid: string;
  device_id: string;
  device_fingerprint: string;
  device_name: string;
  os_info: string;
  company_id?: string;
  user_pincode?: string;
  location?: Record<string, unknown>;
}): Promise<{ success: boolean; days_remaining?: number; end_date?: { seconds: number } }> {
  const fn = httpsCallable(requireFns(), 'createTrial');
  const res = await fn(params);
  return res.data as { success: boolean; days_remaining?: number; end_date?: { seconds: number } };
}

export async function validateTrialRemote(
  mobileNo: string,
  deviceId: string,
  extras?: { device_fingerprint?: string; company_id?: string }
): Promise<ValidateTrialResult> {
  const fn = httpsCallable(requireFns(), 'validateTrial');
  const res = await fn({
    mobile_no: normalizeMobile(mobileNo),
    device_id: deviceId,
    device_fingerprint: extras?.device_fingerprint ?? deviceId,
    company_id: extras?.company_id ?? '',
  });
  return res.data as ValidateTrialResult;
}

/** Block if this device already consumed a trial (any mobile). */
export async function assertDeviceTrialAllowed(deviceId: string): Promise<void> {
  const existing = await checkTrialByDevice(deviceId);
  if (existing) {
    throw new Error('A trial has already been used on this device.');
  }
  const remote = await validateTrialRemote('', deviceId);
  if (remote.status === 'DEVICE_BLOCKED') {
    throw new Error(remote.message || 'A trial has already been used on this device.');
  }
}

export async function updateLastLogin(mobileNo: string): Promise<void> {
  if (!db) return;
  const key = normalizeMobile(mobileNo);
  try {
    await updateDoc(doc(db, 'trials', key), {
      last_login: serverTimestamp(),
      login_count: increment(1),
      updated_at: serverTimestamp(),
    });
  } catch {
    // Cloud Function may have already updated; rules block client writes on some fields
  }
}

export async function saveTrialCache(data: TrialCache): Promise<void> {
  const deviceId = await getDeviceId();
  await setEncryptedItem(TRIAL_CACHE_KEY, deviceId, data);
  setTrialUserFlag(true);
  localStorage.setItem(TRIAL_LAST_VALIDATED_KEY, String(Date.now()));
}

export async function getTrialCache(): Promise<TrialCache | null> {
  const deviceId = await getDeviceId();
  return (await getEncryptedItem<TrialCache>(TRIAL_CACHE_KEY, deviceId)) ?? null;
}

export async function clearTrialCache(): Promise<void> {
  const deviceId = await getDeviceId();
  removeEncryptedItem(TRIAL_CACHE_KEY);
  setTrialUserFlag(false);
  localStorage.removeItem(TRIAL_LAST_VALIDATED_KEY);
  void deviceId;
}

export function trialEndMs(cache: TrialCache): number {
  return cache.trial_end_timestamp * 1000;
}

export function isTrialCacheExpired(cache: TrialCache, now = Date.now()): boolean {
  return now >= trialEndMs(cache);
}

export function isTrialCacheStaleForOffline(now = Date.now()): boolean {
  const last = Number(localStorage.getItem(TRIAL_LAST_VALIDATED_KEY) || 0);
  if (!last) return true;
  return now - last > CACHE_MAX_OFFLINE_MS;
}

export async function resolveTrialStartup(): Promise<
  | { ok: true; cache: TrialCache; offline?: boolean }
  | { ok: false; reason: ValidateTrialResult['status']; message?: string; mobileNo?: string; endDate?: number }
  | { ok: false; reason: 'NO_CACHE' }
> {
  if (!isTrialUserFlag()) return { ok: false, reason: 'NO_CACHE' };
  const cache = await getTrialCache();
  if (!cache) return { ok: false, reason: 'NO_CACHE' };

  if (!isTrialCacheExpired(cache)) {
    if (!navigator.onLine || isTrialCacheStaleForOffline()) {
      return { ok: true, cache, offline: !navigator.onLine };
    }
    try {
      const remote = await validateTrialRemote(cache.mobile_no, cache.device_id);
      if (remote.status === 'VALID') {
        const updated: TrialCache = {
          ...cache,
          days_remaining: remote.days_remaining ?? cache.days_remaining,
          status: 'VALID',
          cached_at: Date.now(),
          trial_end_timestamp: remote.trial_end_date?.seconds ?? cache.trial_end_timestamp,
        };
        await saveTrialCache(updated);
        return { ok: true, cache: updated };
      }
      return {
        ok: false,
        reason: remote.status,
        message: remote.message,
        mobileNo: cache.mobile_no,
        endDate: cache.trial_end_timestamp * 1000,
      };
    } catch {
      if (!isTrialCacheStaleForOffline()) {
        return { ok: true, cache, offline: true };
      }
    }
  }

  if (navigator.onLine) {
    try {
      const remote = await validateTrialRemote(cache.mobile_no, cache.device_id);
      if (remote.status === 'VALID') {
        const updated: TrialCache = {
          ...cache,
          days_remaining: remote.days_remaining ?? 1,
          status: 'VALID',
          cached_at: Date.now(),
        };
        await saveTrialCache(updated);
        return { ok: true, cache: updated };
      }
      return {
        ok: false,
        reason: remote.status,
        message: remote.message,
        mobileNo: cache.mobile_no,
        endDate: cache.trial_end_timestamp * 1000,
      };
    } catch {
      // fall through
    }
  }

  if (!isTrialCacheStaleForOffline() && !isTrialCacheExpired(cache)) {
    return { ok: true, cache, offline: true };
  }

  return {
    ok: false,
    reason: 'EXPIRED',
    mobileNo: cache.mobile_no,
    endDate: cache.trial_end_timestamp * 1000,
  };
}

export function maskMobile(mobile: string): string {
  const m = normalizeMobile(mobile);
  if (m.length !== 10) return m;
  return `${m.slice(0, 2)}XXXX${m.slice(6)}`;
}
