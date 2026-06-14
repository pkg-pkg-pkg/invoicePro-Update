/**
 * Login Service - Unified login flow
 *
 * LOCAL ONLY after first activation:
 * - App start / login read permanent encrypted cache (no validateLicense CF)
 *
 * CLOUD CALL - only these 3 cases (see licenseService.ts):
 * 1. activateLicense() - first activation
 * 2. transferLicense() - device change
 * 3. manual verify button in Settings
 */

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import {
  verifyActivationKey,
  callActivateLicense,
  checkDeviceTransfer,
  surrenderOldDevice,
  getActivationKeyByEmail,
  migrateLicenseCacheIfNeeded,
  readLocalLicenseCache,
} from './licenseService';
import { setEncryptedItem } from './secureStorage';
import { getDeviceId } from './deviceService';
import { isLocalTrialActive, isTrialAccountEmail } from './localTrialService';
import { detectDeviceChange, bindCurrentDevice } from './deviceChangeDetector';
import { syncPasswordToFirestore } from './userProfileService';
import { isElectronRuntime } from '../utils/runtime';
import { validateDesktopSession } from './sessionManager';

const USERS_STORAGE_KEY = 'gst_billing_users';
const LOCAL_LICENSE_CACHE_KEY = 'enc_license_cache_v1';
const LICENSE_VALIDATION_RECORD_KEY = 'license_validation_record_v1';

type LicenseValidationRecord = {
  validatedAt: number;
  isValid: boolean;
  multiUserLan?: boolean;
  reason?: string;
};

function readLicenseValidationRecord(): LicenseValidationRecord | null {
  try {
    const raw = localStorage.getItem(LICENSE_VALIDATION_RECORD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LicenseValidationRecord;
  } catch {
    return null;
  }
}

function writeLicenseValidationRecord(record: LicenseValidationRecord): void {
  try {
    localStorage.setItem(LICENSE_VALIDATION_RECORD_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

/**
 * Fast local-only licence gate for startup — never hits validateLicense CF.
 * Permanent cache (permanently_activated) never expires.
 */
export async function getOptimisticStartupLicense(): Promise<{
  isValid: boolean;
  needsActivation: boolean;
  multiUserLan?: boolean;
  reason?: string;
  fromLocalCache: boolean;
}> {
  const stored = getStoredAuthUser();
  const activeUser = auth?.currentUser;
  if (!activeUser && !stored?.email) {
    return { isValid: false, needsActivation: true, reason: 'Authentication required', fromLocalCache: false };
  }

  const email = String(activeUser?.email ?? stored?.email ?? '').trim().toLowerCase();
  if (isTrialAccountEmail(email) && (await isLocalTrialActive())) {
    return {
      isValid: true,
      needsActivation: false,
      fromLocalCache: true,
    };
  }

  const deviceId = await getDeviceId();
  await migrateLicenseCacheIfNeeded(deviceId);
  const cache = await readLocalLicenseCache(deviceId);
  const cachedKey = cache?.licenseKey || cache?.activationKey;

  if (!cachedKey) {
    const record = readLicenseValidationRecord();
    if (record?.isValid) {
      return {
        isValid: true,
        needsActivation: false,
        multiUserLan: Boolean(record.multiUserLan),
        fromLocalCache: true,
      };
    }
    return { isValid: false, needsActivation: true, reason: 'No license found', fromLocalCache: false };
  }

  if (cache?.licenseExpiry) {
    const ms = toExpiryMs(cache.licenseExpiry);
    if (ms && ms < Date.now()) {
      return { isValid: false, needsActivation: true, reason: 'License has expired', fromLocalCache: true };
    }
  }

  if (cache?.permanently_activated || cachedKey) {
    return {
      isValid: true,
      needsActivation: false,
      multiUserLan: Boolean(cache?.multiUserLan),
      fromLocalCache: true,
    };
  }

  if (isElectronRuntime()) {
    const desktopSession = await validateDesktopSession();
    if (desktopSession.valid) {
      return {
        isValid: true,
        needsActivation: false,
        multiUserLan: Boolean(cache?.multiUserLan),
        fromLocalCache: true,
      };
    }
  }

  return {
    isValid: false,
    needsActivation: true,
    reason: 'No license found',
    fromLocalCache: false,
  };
}

export function persistLicenseValidationResult(result: {
  isValid: boolean;
  multiUserLan?: boolean;
  reason?: string;
}): void {
  writeLicenseValidationRecord({
    validatedAt: Date.now(),
    isValid: result.isValid,
    multiUserLan: result.multiUserLan,
    reason: result.reason,
  });
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase();
const isOnline = () => {
  try {
    return navigator.onLine !== false;
  } catch {
    return true;
  }
};

const toExpiryMs = (raw: any): number | null => {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw?.toMillis === 'function') return Number(raw.toMillis());
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export type LocalUser = {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  password: string;
  role?: string;
  isActive?: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
  passwordResetRequired?: boolean;
  activationKey?: string;
};

export type LoginResult = {
  success: boolean;
  needsActivation?: boolean;
  reason?: string;
  user?: LocalUser;
};

function loadLocalUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalUser[]) : [];
  } catch {
    return [];
  }
}

function getStoredActivationKey(email: string, users: LocalUser[]): string | null {
  const u = users.find((x) => norm(x?.email) === norm(email) || norm(x?.username) === norm(email));
  const key = (u as any)?.activationKey || localStorage.getItem(`activation_key_${norm(email)}`);
  return key ? String(key).trim() : null;
}

/**
 * Core login: verify credentials and activation, return user if valid.
 */
export async function performLogin(
  email: string,
  password: string,
  activationKeyFromForm?: string
): Promise<LoginResult> {
  const ident = email.trim();
  if (!ident || !password) {
    return { success: false, needsActivation: true, reason: 'Email and password required' };
  }

  const users = loadLocalUsers();
  const deviceId = await getDeviceId();
  let localActivationHint = '';

  const localUser = users.find((x) => norm(x?.email) === norm(ident) || norm(x?.username) === norm(ident));

  if (localUser && String(localUser.password) === String(password)) {
    localActivationHint = activationKeyFromForm?.trim() || localUser.activationKey || '';
    if (!localActivationHint) {
      localActivationHint = localStorage.getItem(`activation_key_${norm(ident)}`) || '';
    }

    if (!isOnline()) {
      const deviceCheck = await detectDeviceChange();
      if (!deviceCheck.changed) {
        await migrateLicenseCacheIfNeeded(deviceId);
        const cache = await readLocalLicenseCache(deviceId);
        const cachedKey = String(cache?.licenseKey || cache?.activationKey || '').trim();
        const cacheEmail = norm(cache?.email || ident);
        const expiryMs = toExpiryMs(cache?.licenseExpiry);
        const notExpired = !expiryMs || expiryMs >= Date.now();
        if (cachedKey && cacheEmail === norm(ident) && notExpired) {
          return { success: true, user: localUser };
        }
      }
      return {
        success: false,
        needsActivation: true,
        reason: 'Offline login denied: valid local activation cache not found.',
      };
    }
  }

  try {
    if (!auth) {
      return { success: false, needsActivation: true, reason: 'Firebase not configured' };
    }

    await signInWithEmailAndPassword(auth, ident, password);

    let activationKey = activationKeyFromForm?.trim() || localActivationHint || '';
    let licenseData: any = null;

    if (!activationKey) {
      const keyResult = await getActivationKeyByEmail(ident);
      if (!keyResult.found) {
        return {
          success: false,
          needsActivation: true,
          reason: 'No license found for this email. Please activate your account.',
        };
      }
      activationKey = keyResult.activationKey || '';
      licenseData = keyResult.licenseData;
    } else {
      const verification = await verifyActivationKey(activationKey, ident);
      if (!verification.allowLogin) {
        return {
          success: false,
          needsActivation: true,
          reason: verification.reason || 'Invalid activation key',
        };
      }
      licenseData = verification.licenseData;
    }

    const currentDeviceId = licenseData?.currentDeviceId;
    if (currentDeviceId && currentDeviceId !== deviceId) {
      return {
        success: false,
        needsActivation: true,
        reason: `DEVICE_TRANSFER_NEEDED|${JSON.stringify({
          deviceId: currentDeviceId,
          activatedAt: licenseData.activatedAt,
          lastSeen: licenseData.lastSeen,
        })}`,
      };
    }

    await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, {
      email: ident,
      licenseKey: activationKey,
      licenseExpiry: licenseData?.expiryDate,
      cachedAt: Date.now(),
      permanently_activated: true,
      activated_at: new Date().toISOString(),
      activation_device_id: deviceId,
    });

    const user = await ensureLocalUser(ident, password, activationKey);
    await syncPasswordToFirestore(ident, password);

    if (!currentDeviceId) {
      await bindCurrentDevice(ident);
    }

    return { success: true, user };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { success: false, needsActivation: true, reason: 'User not found in Firebase. Please activate your account.' };
    }
    if (error.code === 'auth/wrong-password') {
      return { success: false, reason: 'Invalid email or password' };
    }
    if (error.code === 'auth/too-many-requests') {
      return { success: false, reason: 'Too many login attempts. Please try again later.' };
    }
    if (error.code === 'auth/invalid-credential') {
      return {
        success: false,
        needsActivation: true,
        reason: 'Firebase authentication failed. Please enter activation key or activate your account.',
      };
    }
    return { success: false, reason: error.message || 'Login failed' };
  }
}

async function ensureLocalUser(email: string, password: string, activationKey: string): Promise<LocalUser> {
  const now = new Date().toISOString();
  const ident = norm(email);
  const adminUser: LocalUser = {
    id: Date.now().toString(),
    username: email.trim(),
    email: email.trim(),
    fullName: email.trim(),
    password: String(password),
    role: 'admin',
    isActive: true,
    lastLogin: now,
    createdAt: now,
    updatedAt: now,
    activationKey: activationKey.trim(),
  };

  const existing = loadLocalUsers();
  const without = existing.filter((u) => norm(u.email) !== ident && norm(u.username) !== ident);
  const merged = [adminUser, ...without];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
  localStorage.setItem('lastLoginEmail', email.trim());
  localStorage.setItem('ownerEmail', email.trim());
  localStorage.setItem(`activation_key_${ident}`, activationKey.trim());
  return adminUser;
}

function getStoredAuthUser(): { email: string; id: string } | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as { email?: string; username?: string; id?: string };
    const email = norm(u.email || u.username);
    if (!email) return null;
    return { email, id: String(u.id || '') };
  } catch {
    return null;
  }
}

/**
 * LOCAL ONLY licence gate for app startup and login (after authentication).
 * Never calls validateLicense Cloud Function.
 */
export async function validateLicenseAndDevice(): Promise<{
  isValid: boolean;
  needsActivation: boolean;
  reason?: string;
  multiUserLan?: boolean;
}> {
  try {
    const deviceId = await getDeviceId();
    await migrateLicenseCacheIfNeeded(deviceId);

    const activeUser = auth?.currentUser;
    const stored = getStoredAuthUser();
    if (!activeUser && !stored?.email) {
      return {
        isValid: false,
        needsActivation: true,
        reason: 'Authentication required',
      };
    }

    const sessionEmail = activeUser ? norm(activeUser.email || '') : stored!.email;
    const sessionUid = activeUser ? String(activeUser.uid || '') : stored!.id;

    const deviceCheck = await detectDeviceChange();
    if (deviceCheck.changed) {
      return {
        isValid: false,
        needsActivation: true,
        reason: deviceCheck.reason || 'Device change detected',
      };
    }

    const cache = await readLocalLicenseCache(deviceId);
    const cachedKey = cache?.licenseKey || cache?.activationKey;

    if (!cachedKey) {
      if (!activeUser && isElectronRuntime()) {
        const desktopSession = await validateDesktopSession();
        if (desktopSession.valid) {
          return { isValid: false, needsActivation: true, reason: 'Sign in to restore licence on this PC.' };
        }
      }
      return {
        isValid: false,
        needsActivation: true,
        reason: isOnline() ? 'No licence on this device. Activate or sign in online once.' : 'No local licence cache.',
      };
    }

    const cacheUid = String(cache?.uid || '');
    if (activeUser && cacheUid && cacheUid !== sessionUid) {
      return {
        isValid: false,
        needsActivation: true,
        reason: 'License cache user mismatch',
      };
    }

    const cacheEmail = String(cache?.email || '').trim().toLowerCase();
    if (cacheEmail && sessionEmail && cacheEmail !== sessionEmail) {
      return {
        isValid: false,
        needsActivation: true,
        reason: 'License cache email mismatch',
      };
    }

    if (cache?.licenseExpiry) {
      const ms = toExpiryMs(cache.licenseExpiry);
      if (ms && ms < Date.now()) {
        return {
          isValid: false,
          needsActivation: true,
          reason: 'License has expired',
        };
      }
    }

    const ok = {
      isValid: true,
      needsActivation: false,
      multiUserLan: Boolean(cache?.multiUserLan),
    };
    persistLicenseValidationResult(ok);
    return ok;
  } catch (err: any) {
    return {
      isValid: false,
      needsActivation: true,
      reason: 'License check failed: ' + (err?.message ?? ''),
    };
  }
}
