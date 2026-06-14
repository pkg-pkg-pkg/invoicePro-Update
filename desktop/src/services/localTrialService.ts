import { TRIAL_EMAIL } from '../constants/trialCredentials';
import { readLocalLicenseCache } from './licenseService';
import { getDeviceId } from './deviceService';
import { isElectronRuntime } from '../utils/runtime';

export const TRIAL_START_DATE_KEY = 'trial_start_date';
export const TRIAL_MOBILE_KEY = 'trial_mobile';
export const TRIAL_DEVICE_KEY = 'trial_device';
export const TRIAL_GATE_SESSION_KEY = 'trial_gate_passed';
export const TRIAL_BANNER_DISMISSED_KEY = 'trial_banner_dismissed';
export const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

async function readKv<T>(key: string): Promise<T | null> {
  try {
    if (isElectronRuntime() && window.electronAPI?.storageRead) {
      return (await window.electronAPI.storageRead<T>(key)) ?? null;
    }
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  } catch {
    return null;
  }
}

async function writeKv(key: string, value: unknown): Promise<void> {
  if (isElectronRuntime() && window.electronAPI?.storageWrite) {
    await window.electronAPI.storageWrite(key, value);
    return;
  }
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

async function removeKv(key: string): Promise<void> {
  if (isElectronRuntime() && window.electronAPI?.storageRemove) {
    await window.electronAPI.storageRemove(key);
    return;
  }
  localStorage.removeItem(key);
}

export async function getTrialStartDate(): Promise<number | null> {
  const raw = await readKv<number | string>(TRIAL_START_DATE_KEY);
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function ensureTrialStartDate(): Promise<number> {
  const existing = await getTrialStartDate();
  if (existing != null) return existing;
  const now = Date.now();
  await writeKv(TRIAL_START_DATE_KEY, now);
  return now;
}

export async function clearTrialStartDate(): Promise<void> {
  await removeKv(TRIAL_START_DATE_KEY);
  await removeKv(TRIAL_MOBILE_KEY);
  await removeKv(TRIAL_DEVICE_KEY);
  try {
    sessionStorage.removeItem(TRIAL_BANNER_DISMISSED_KEY);
    sessionStorage.removeItem(TRIAL_GATE_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function setTrialGatePassed(): void {
  try {
    sessionStorage.setItem(TRIAL_GATE_SESSION_KEY, '1');
  } catch {
    // ignore
  }
}

export function isTrialGatePassed(): boolean {
  try {
    return sessionStorage.getItem(TRIAL_GATE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export async function saveTrialKvMeta(mobile: string, deviceId: string): Promise<void> {
  await ensureTrialStartDate();
  await writeKv(TRIAL_MOBILE_KEY, mobile);
  await writeKv(TRIAL_DEVICE_KEY, deviceId);
}

export function isTrialExpired(startMs: number, now = Date.now()): boolean {
  return now - startMs >= TRIAL_MS;
}

export function trialDaysRemaining(startMs: number, now = Date.now()): number {
  const end = startMs + TRIAL_MS;
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

export async function isLicensedUser(): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const cache = await readLocalLicenseCache(deviceId);
    if (cache?.permanently_activated && (cache.licenseKey || cache.activationKey)) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export async function isLocalTrialActive(): Promise<boolean> {
  if (await isLicensedUser()) return false;
  const start = await getTrialStartDate();
  if (start == null) return false;
  return !isTrialExpired(start);
}

export async function isLocalTrialExpired(): Promise<boolean> {
  if (await isLicensedUser()) return false;
  const start = await getTrialStartDate();
  if (start == null) return false;
  return isTrialExpired(start);
}

export function isTrialAccountEmail(email: string | null | undefined): boolean {
  return String(email ?? '').trim().toLowerCase() === TRIAL_EMAIL;
}

export function isTrialBannerDismissed(): boolean {
  try {
    return sessionStorage.getItem(TRIAL_BANNER_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissTrialBanner(): void {
  try {
    sessionStorage.setItem(TRIAL_BANNER_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
}
