/**
 * Obtains JWT from Invoice Pro middleware (ipa) for desktop → cloud sync.
 */

import { getCachedCompanyProfile } from '../companyProfileDbService';
import { syncElectronStore } from './syncElectronStore';

export const DESKTOP_SYNC_DEFAULT_MOBILE = '0000000000';
const DESKTOP_SYNC_DEFAULT_NAME = 'Desktop Sync';

type IpaLoginResponse = {
  token: string;
  user: { user_id: string; name?: string };
};

type IpaRegisterResponse = {
  user_id: string;
};

function normalizeMobileNo(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(0, 15);
  return DESKTOP_SYNC_DEFAULT_MOBILE;
}

export async function resolveMiddlewareMobileNo(hint?: string): Promise<string> {
  if (hint?.trim()) {
    const normalized = normalizeMobileNo(hint);
    if (normalized !== DESKTOP_SYNC_DEFAULT_MOBILE || hint.replace(/\D/g, '').length >= 10) {
      return normalized;
    }
  }

  const profilePhone = getCachedCompanyProfile()?.phone?.trim();
  if (profilePhone) {
    const normalized = normalizeMobileNo(profilePhone);
    if (normalized.length >= 10) return normalized;
  }

  return DESKTOP_SYNC_DEFAULT_MOBILE;
}

async function middlewareApiBase(): Promise<string> {
  return (await syncElectronStore.getMiddlewareUrl()).replace(/\/$/, '');
}

/** True when cloud middleware sync should run (explicitly enabled + URL configured). */
export async function shouldAttemptMiddlewareSync(): Promise<boolean> {
  const enabled = await syncElectronStore.getSyncEnabled();
  if (!enabled) return false;
  const url = (await syncElectronStore.getMiddlewareUrl()).trim();
  return Boolean(url);
}

async function middlewareLogin(
  mobileNo: string
): Promise<{ token: string; userId: string } | null> {
  const apiUrl = await middlewareApiBase();
  const mobile_no = normalizeMobileNo(mobileNo);

  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_no }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn('[middleware-sync] login failed:', res.status, (body as { error?: string }).error);
      return null;
    }

    const data = (await res.json()) as IpaLoginResponse;
    if (!data.token || !data.user?.user_id) return null;
    return { token: data.token, userId: data.user.user_id };
  } catch (err) {
    console.warn('[middleware-sync] login error:', err);
    return null;
  }
}

async function middlewareRegister(mobileNo: string, name = DESKTOP_SYNC_DEFAULT_NAME): Promise<boolean> {
  const apiUrl = await middlewareApiBase();
  const mobile_no = normalizeMobileNo(mobileNo);

  try {
    const res = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_no, name }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn('[middleware-sync] register failed:', res.status, (body as { error?: string }).error);
      return false;
    }

    const data = (await res.json()) as IpaRegisterResponse;
    return Boolean(data.user_id);
  } catch (err) {
    console.warn('[middleware-sync] register error:', err);
    return false;
  }
}

/**
 * Login to middleware and persist syncJwtToken (+ userUUID when missing).
 * When registerIfMissing is true, creates the default desktop sync user on 404.
 */
export async function ensureMiddlewareSyncToken(options?: {
  mobileNo?: string;
  registerIfMissing?: boolean;
}): Promise<boolean> {
  if (!(await shouldAttemptMiddlewareSync())) {
    return false;
  }

  const existing = (await syncElectronStore.getJwtToken()).trim();
  if (existing) return true;

  const mobileNo = await resolveMiddlewareMobileNo(options?.mobileNo);
  let session = await middlewareLogin(mobileNo);

  if (!session && options?.registerIfMissing) {
    console.info('[middleware-sync] registering desktop sync user for', mobileNo);
    const registered = await middlewareRegister(mobileNo, DESKTOP_SYNC_DEFAULT_NAME);
    if (registered) {
      session = await middlewareLogin(mobileNo);
    }
  }

  if (!session?.token) return false;

  await syncElectronStore.setJwtToken(session.token);

  const userUUID = (await syncElectronStore.getUserUUID()).trim();
  if (!userUUID) {
    await syncElectronStore.setUserUUID(session.userId);
  }

  console.info('[middleware-sync] syncJwtToken saved for middleware user', session.userId);
  return true;
}

/**
 * Ensures JWT, middleware user UUID, and syncEnabled before capture/drain.
 * Auto-registers desktop sync user on ipa when missing.
 */
export async function ensureSyncReady(): Promise<boolean> {
  if (!(await shouldAttemptMiddlewareSync())) {
    return false;
  }

  const tokenOk = await ensureMiddlewareSyncToken({ registerIfMissing: true });
  if (!tokenOk) {
    console.warn('[middleware-sync] ensureSyncReady: no syncJwtToken');
    return false;
  }

  const userUUID = (await syncElectronStore.getUserUUID()).trim();
  if (!userUUID) {
    console.warn('[middleware-sync] ensureSyncReady: userUUID missing after login');
    return false;
  }

  return true;
}
