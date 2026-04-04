/**
 * Login Service - Unified login flow
 *
 * Flow:
 * 1. User provides: email, password, activation key (from form or stored)
 * 2. Firebase sign-in (required for Firestore security rules)
 * 3. Verify activation key against Firestore
 * 4. If valid: ensure local user exists, cache license, bind device → LOGIN
 * 5. If invalid: → SHOW ACTIVATION
 */

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import {
  verifyActivationKey,
  callVerifyActivationForLogin,
  callActivateLicense,
  validateOnLoginOrStart,
  checkDeviceTransfer,
  surrenderOldDevice,
  getActivationKeyByEmail,
} from './licenseService';
import { getEncryptedItem, setEncryptedItem } from './secureStorage';
import { getDeviceId } from './deviceService';
import { detectDeviceChange, bindCurrentDevice } from './deviceChangeDetector';
import { syncPasswordToFirestore } from './userProfileService';

const USERS_STORAGE_KEY = 'gst_billing_users';
const LOCAL_LICENSE_CACHE_KEY = 'enc_license_cache_v1';

const norm = (v: any) => String(v ?? '').trim().toLowerCase();

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

function isCacheValid(cache: any, email: string, key: string): boolean {
  if (!cache?.licenseKey) return false;
  const cacheEmail = norm(String(cache.email ?? ''));
  const cacheKey = String(cache.licenseKey ?? '').trim().toUpperCase();
  if (cacheEmail !== norm(email) || cacheKey !== key.trim().toUpperCase()) return false;
  if (cache.licenseExpiry) {
    const ms = typeof cache.licenseExpiry === 'number' ? cache.licenseExpiry : cache.licenseExpiry?.toMillis?.();
    if (ms && ms < Date.now()) return false;
  }
  return true;
}

function getStoredActivationKey(email: string, users: LocalUser[]): string | null {
  const u = users.find((x) => norm(x?.email) === norm(email) || norm(x?.username) === norm(email));
  const key = (u as any)?.activationKey || localStorage.getItem(`activation_key_${norm(email)}`);
  return key ? String(key).trim() : null;
}

/**
 * Core login: verify credentials and activation, return user if valid.
 * NEW LOGIC: 
 * 1. Check local users first
 * 2. Try Firebase auth if available
 * 3. Get activation key from Firestore by email
 * 4. Check device binding and handle transfer
 * 5. Allow login or show activation
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

  // --- Step 1: Check local user first (for existing accounts)
  const localUser = users.find((x) => norm(x?.email) === norm(ident) || norm(x?.username) === norm(ident));
  
  if (localUser && String(localUser.password) === String(password)) {
    console.log('✅ Local user authentication successful for:', ident);
    
    // Get activation key from local user or form
    let activationKey = activationKeyFromForm?.trim() || localUser.activationKey || '';
    
    if (!activationKey) {
      // Try to get from localStorage
      activationKey = localStorage.getItem(`activation_key_${norm(ident)}`) || '';
    }

    if (activationKey) {
      console.log('✅ Using stored activation key:', activationKey);
      
      // Cache and bind device
      await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, {
        email: ident,
        // store under licenseKey so startup validation can see it
        licenseKey: activationKey,
        cachedAt: new Date().toISOString(),
      });

      // Also ensure Firestore has the latest password for this user.
      await syncPasswordToFirestore(ident, password);
      
      return { success: true, user: localUser };
    } else {
      return { 
        success: false, 
        needsActivation: true, 
        reason: 'Local user found but no activation key. Please enter activation key.' 
      };
    }
  }

  // --- Step 2: Try Firebase authentication for new users or missing local users
  try {
    if (!auth) {
      return { success: false, needsActivation: true, reason: 'Firebase not configured' };
    }

    await signInWithEmailAndPassword(auth, ident, password);
    console.log('✅ Firebase authentication successful for:', ident);

    // --- Step 3: Get activation key from Firestore by email
    let activationKey = activationKeyFromForm?.trim() || '';
    let licenseData: any = null;

    if (!activationKey) {
      const keyResult = await getActivationKeyByEmail(ident);
      
      if (!keyResult.found) {
        console.log('❌ No license found for email:', keyResult.reason);
        return { 
          success: false, 
          needsActivation: true, 
          reason: 'No license found for this email. Please activate your account.' 
        };
      }

      activationKey = keyResult.activationKey || '';
      licenseData = keyResult.licenseData;
      console.log('✅ Retrieved activation key from Firestore:', activationKey);
    } else {
      const verification = await verifyActivationKey(activationKey, ident);
      if (!verification.allowLogin) {
        return { 
          success: false, 
          needsActivation: true, 
          reason: verification.reason || 'Invalid activation key' 
        };
      }
      licenseData = verification.licenseData;
    }

    // --- Step 4: Check device binding and handle transfer
    const currentDeviceId = licenseData?.currentDeviceId;
    
    if (currentDeviceId && currentDeviceId !== deviceId) {
      console.log('🔍 Device mismatch detected:');
      console.log('🔍 Old Device:', currentDeviceId);
      console.log('🔍 New Device:', deviceId);
      
      return {
        success: false,
        needsActivation: true,
        // CONTRACT: Login page expects `DEVICE_TRANSFER_NEEDED|{jsonOldDeviceInfo}`
        reason: `DEVICE_TRANSFER_NEEDED|${JSON.stringify({
          deviceId: currentDeviceId,
          activatedAt: licenseData.activatedAt,
          lastSeen: licenseData.lastSeen,
        })}`,
      };
    }

    // --- Step 5: Device matches or no device binding - proceed with login
    console.log('✅ Device validation passed - proceeding with login');

    // Cache activation key locally for offline use
    await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, {
      email: ident,
      licenseKey: activationKey,
      licenseExpiry: licenseData?.expiryDate,
      cachedAt: new Date().toISOString(),
    });

    // Ensure local user exists
    const user = await ensureLocalUser(ident, password, activationKey);
    // Keep Firestore copy of password up to date for cross-device restore.
    await syncPasswordToFirestore(ident, password);
    
    // Bind current device if not already bound
    if (!currentDeviceId) {
      await bindCurrentDevice(ident);
    }

    return { success: true, user };

  } catch (error: any) {
    console.error('❌ Firebase authentication failed:', error);
    
    // Handle Firebase auth errors gracefully
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
      return { success: false, needsActivation: true, reason: 'Firebase authentication failed. Please enter activation key or activate your account.' };
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

/**
 * License validation for app startup (after user is authenticated).
 */
export async function validateLicenseAndDevice(): Promise<{
  isValid: boolean;
  needsActivation: boolean;
  reason?: string;
  /** Firestore multi-user / LAN product flag (cached after online validation). */
  multiUserLan?: boolean;
}> {
  try {
    const deviceId = await getDeviceId();

    // Development bypass - remove this in production
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development mode: Bypassing license validation');
      return {
        isValid: true,
        needsActivation: false,
        reason: 'Development bypass - license validation skipped',
        multiUserLan: true,
      };
    }

    // First ensure the local device binding hasn't changed
    const deviceCheck = await detectDeviceChange();
    if (deviceCheck.changed) {
      return {
        isValid: false,
        needsActivation: true,
        reason: deviceCheck.reason || 'Device change detected',
      };
    }

    // Then look for an encrypted, cached license for this device.
    // Older builds may have stored `activationKey`, newer ones store `licenseKey`.
    const cache = (await getEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId)) as
      | { licenseKey?: string; activationKey?: string; licenseExpiry?: any; multiUserLan?: boolean }
      | null;

    const cachedKey = cache?.licenseKey || cache?.activationKey;
    if (cachedKey) {
      // If an expiry is cached, honour it locally so we don't allow use past expiry.
      if (cache?.licenseExpiry) {
        const ms =
          typeof cache.licenseExpiry === 'number'
            ? cache.licenseExpiry
            : (cache.licenseExpiry as any)?.toMillis?.();
        if (ms && ms < Date.now()) {
          return {
            isValid: false,
            needsActivation: true,
            reason: 'License has expired',
          };
        }
      }

      // Local cache and binding are valid – no need to hit Firestore.
      return { isValid: true, needsActivation: false, multiUserLan: Boolean(cache?.multiUserLan) };
    }

    // As a fallback (typically first login on a new install) try online validation
    // if we have an authenticated Firebase user.
    if (auth?.currentUser) {
      try {
        console.log(' Calling validateOnLoginOrStart...');
        const result = await validateOnLoginOrStart();
        console.log(' License validation result:', result);
        if (result.ok) {
          return { isValid: true, needsActivation: false, multiUserLan: Boolean((result as any).multiUserLan) };
        }
        return {
          isValid: false,
          needsActivation: true,
          reason: (result as any).reason || 'License validation failed',
        };
      } catch (err) {
        console.error(' Error in validateOnLoginOrStart:', err);
        return {
          isValid: false,
          needsActivation: true,
          reason: `License validation error: ${(err as any).message || 'Unknown error'}`,
        };
      }
    }

    // No cache and no online session – treat as needing activation.
    return { isValid: false, needsActivation: true, reason: 'No license found' };
  } catch (err: any) {
    return {
      isValid: false,
      needsActivation: true,
      reason: 'License check failed: ' + (err?.message ?? ''),
    };
  }
}
