import type { ElectronAPI } from '../types/electron';
import { isElectronRuntime } from '../utils/runtime';
import { withTimeout } from '../utils/withTimeout';

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
  company: null;
  completedBusinessProfile?: boolean;
};

export type SessionValidateResult = {
  valid: boolean;
  reason?: string;
  sessionToken?: string;
  sessionExpiry?: string;
  lastCompany?: string;
  rememberMe?: boolean;
  user?: SessionUser;
  migrated?: boolean;
};

export type SessionLoginResult = {
  success: boolean;
  reason?: string;
  sessionToken?: string;
  sessionExpiry?: string;
  user?: SessionUser;
};

const api = (): ElectronAPI | undefined => (isElectronRuntime() ? window.electronAPI : undefined);

export async function validateDesktopSession(): Promise<SessionValidateResult> {
  if (!api()?.sessionValidate) return { valid: false, reason: 'not_electron' };
  return withTimeout(
    api()!.sessionValidate!() as Promise<SessionValidateResult>,
    5000,
    { valid: false, reason: 'session_validate_timeout' }
  );
}

export async function loginDesktopSession(input: {
  username: string;
  password: string;
  rememberMe?: boolean;
  lastCompany?: string;
}): Promise<SessionLoginResult> {
  if (!api()?.sessionLogin) {
    return { success: false, reason: 'Sessions are only available in the desktop app.' };
  }
  return (await api()!.sessionLogin!({
    username: input.username,
    password: input.password,
    rememberMe: Boolean(input.rememberMe),
    lastCompany: input.lastCompany || localStorage.getItem('pve_active_company_id') || '',
  })) as SessionLoginResult;
}

export async function registerDesktopSession(input: {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
  rememberMe?: boolean;
  lastCompany?: string;
}): Promise<SessionLoginResult & { sessionToken?: string }> {
  if (!api()?.sessionRegister) {
    return { success: false, reason: 'Sessions are only available in the desktop app.' };
  }
  try {
    const res = (await api()!.sessionRegister!({
      userId: input.userId,
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      password: input.password,
      rememberMe: Boolean(input.rememberMe),
      lastCompany: input.lastCompany || localStorage.getItem('pve_active_company_id') || '',
    })) as SessionLoginResult & { sessionToken?: string; user?: SessionUser };
    if (res && typeof res === 'object' && 'sessionToken' in res && res.sessionToken && res.user) {
      return { ...res, success: true };
    }
    if (res && typeof res === 'object' && 'success' in res && res.success === false) {
      return res as SessionLoginResult & { sessionToken?: string };
    }
    return {
      success: Boolean((res as { sessionToken?: string })?.sessionToken),
      sessionToken: (res as { sessionToken?: string })?.sessionToken,
      user: (res as { user?: SessionUser })?.user,
    };
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('No handler registered')) {
      console.warn('[session] Main process missing session handlers — restart Electron (close all InvoicePro windows, then npm run electron:dev)');
    }
    return { success: false, reason: msg };
  }
}

export async function ensureLegacyDesktopSession(user: {
  userId?: string;
  id?: string;
  username?: string;
  email?: string;
  fullName?: string;
  lastCompany?: string;
}): Promise<SessionValidateResult> {
  if (!api()?.sessionLegacy) return { valid: false, reason: 'not_electron' };
  return (await api()!.sessionLegacy!({
    userId: user.userId || user.id,
    username: user.username || user.email,
    email: user.email,
    fullName: user.fullName,
    lastCompany: user.lastCompany || localStorage.getItem('pve_active_company_id') || '',
  })) as SessionValidateResult;
}

export async function logoutDesktopSession(): Promise<void> {
  if (api()?.sessionLogout) await api()!.sessionLogout!();
}

export async function touchDesktopSession(lastCompany?: string): Promise<void> {
  if (api()?.sessionTouch) await api()!.sessionTouch!(lastCompany);
}

export async function getSessionSettings(): Promise<{ sessionDaysDefault: number; sessionDaysRemember: number }> {
  if (!api()?.sessionGetSettings) {
    return { sessionDaysDefault: 7, sessionDaysRemember: 30 };
  }
  return (await api()!.sessionGetSettings!()) as { sessionDaysDefault: number; sessionDaysRemember: number };
}

export async function setSessionSettings(payload: {
  sessionDaysDefault?: number;
  sessionDaysRemember?: number;
}): Promise<{ sessionDaysDefault: number; sessionDaysRemember: number }> {
  if (!api()?.sessionSetSettings) {
    return { sessionDaysDefault: 7, sessionDaysRemember: 30 };
  }
  return (await api()!.sessionSetSettings!(payload)) as {
    sessionDaysDefault: number;
    sessionDaysRemember: number;
  };
}
