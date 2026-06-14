import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, Timestamp } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/firebase';
import type { LicenseDoc, UserProfileDoc } from '../firebase/models';
import { computeLicenseDeviceKey, getDeviceId } from './deviceService';
import { getEncryptedItem, setEncryptedItem } from './secureStorage';
import { bindCurrentDevice, clearDeviceBinding } from './deviceChangeDetector';
import { clearTrialStartDate } from './localTrialService';
import { syncPasswordToFirestore } from './userProfileService';
import { getBundledAppVersion } from './appUpdateService';
import { withTimeout } from '../utils/withTimeout';

export type LicenseValidationResult = {
  ok: boolean;
  reason?: string;
  license?: LicenseDoc;
};

export type LicenseGateResult =
  | { ok: true; licenseKey: string; completedBusinessProfile: boolean; multiUserLan?: boolean }
  | {
      ok: false;
      reason: string;
      action?: 'transfer_required' | 'expired' | 'activation_required';
      licenseKey?: string;
      currentDeviceId?: string;
      newDeviceId?: string;
    };

export const LOCAL_LICENSE_CACHE_KEY = 'enc_license_cache_v1';

/** Permanent local licence cache — never auto-expires. */
export type LocalLicenseCache = {
  uid?: string;
  email?: string;
  token?: string;
  licenseKey?: string;
  activationKey?: string;
  licenseExpiry?: number | null;
  cachedAt?: number;
  multiUserLan?: boolean;
  gatewayValidUntilMs?: number | null;
  gatewayUpdatesEntitled?: boolean;
  permanently_activated?: boolean;
  activated_at?: string;
  activation_device_id?: string;
  last_online_verify_at?: string;
  /** @deprecated Ignored — cache never auto-expires. */
  cache_expires_at?: number;
};

// CLOUD CALL - only these 3 cases:
// 1. activateLicense() - first activation (callActivateLicense)
// 2. transferLicense() - device change (callTransferLicense)
// 3. manual verify button in Settings (verifyLicenseOnlineManual → validateOnLoginOrStart)

// LOCAL ONLY - everything else:
// - app start, login, daily use, invoicing, reports

export async function readLocalLicenseCache(deviceId: string): Promise<LocalLicenseCache | null> {
  return (await getEncryptedItem<LocalLicenseCache>(LOCAL_LICENSE_CACHE_KEY, deviceId)) ?? null;
}

export function maskLicenseKeyDisplay(key: string): string {
  const k = String(key ?? '').trim().toUpperCase().replace(/-/g, '');
  if (!k) return '—';
  if (k.length <= 4) return `${k}-****`;
  const head = k.slice(0, 12);
  const parts = head.match(/.{1,4}/g) ?? [head];
  return `${parts.join('-')}-****`;
}

function permanentCacheFields(
  deviceId: string,
  activatedAt?: string
): Pick<LocalLicenseCache, 'permanently_activated' | 'activated_at' | 'activation_device_id'> {
  return {
    permanently_activated: true,
    activated_at: activatedAt || new Date().toISOString(),
    activation_device_id: deviceId,
  };
}

/** PART H — migrate existing valid caches to permanent activation (no cloud call). */
export async function migrateLicenseCacheIfNeeded(deviceId: string): Promise<LocalLicenseCache | null> {
  const cache = await readLocalLicenseCache(deviceId);
  if (!cache) return null;
  const hasKey = Boolean(cache.licenseKey || cache.activationKey);
  if (!hasKey) return cache;
  if (cache.permanently_activated) return cache;

  const updated: LocalLicenseCache = {
    ...cache,
    ...permanentCacheFields(
      deviceId,
      cache.activated_at ||
        (cache.cachedAt ? new Date(cache.cachedAt).toISOString() : new Date().toISOString())
    ),
    cachedAt: cache.cachedAt || Date.now(),
  };
  delete updated.cache_expires_at;
  await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, updated);
  return updated;
}

/** LOCAL ONLY — finalize encrypted cache after login (no validateLicense CF). */
export async function finalizeLoginFromLocalCache(params: {
  uid: string;
  email: string;
  licenseKey: string;
  token: string;
  licenseExpiry?: number | null;
  completedBusinessProfile?: boolean;
  multiUserLan?: boolean;
}): Promise<LicenseGateResult> {
  const deviceId = await getDeviceId();
  const email = normalizeEmail(params.email);
  const licenseKey = params.licenseKey.trim().toUpperCase();
  const existing = (await migrateLicenseCacheIfNeeded(deviceId)) ?? {};

  await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, {
    ...existing,
    uid: params.uid,
    email,
    token: params.token,
    licenseKey,
    licenseExpiry: params.licenseExpiry ?? existing.licenseExpiry ?? null,
    cachedAt: Date.now(),
    multiUserLan: params.multiUserLan ?? existing.multiUserLan,
    ...permanentCacheFields(deviceId, existing.activated_at),
  });
  await bindCurrentDevice(email);

  return {
    ok: true,
    licenseKey,
    completedBusinessProfile: Boolean(params.completedBusinessProfile),
    multiUserLan: Boolean(params.multiUserLan ?? existing.multiUserLan),
  };
}

export type ManualVerifyResult =
  | {
      ok: true;
      expiryDateMs: number | null;
      multiUserLan: boolean;
      lastOnlineVerifyAt: string;
    }
  | { ok: false; reason: string };

/** CLOUD CALL #3 — Settings "Verify License Online" only. */
export async function verifyLicenseOnlineManual(): Promise<ManualVerifyResult> {
  if (!auth?.currentUser) return { ok: false, reason: 'Sign in first' };
  if (!navigator.onLine) return { ok: false, reason: 'Internet required for online verification' };

  const gate = await validateOnLoginOrStart();
  if (!gate.ok) {
    return { ok: false, reason: gate.reason || 'License verification failed' };
  }

  const deviceId = await getDeviceId();
  const updated = (await readLocalLicenseCache(deviceId)) ?? {};
  const lastOnlineVerifyAt = updated.last_online_verify_at || new Date().toISOString();
  const expiryDateMs =
    updated.licenseExpiry != null ? Number(updated.licenseExpiry) : null;

  return {
    ok: true,
    expiryDateMs,
    multiUserLan: Boolean(gate.multiUserLan),
    lastOnlineVerifyAt,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function userDocIdForEmail(email: string): string {
  return normalizeEmail(email);
}

async function ensureUserProfileByEmail(email: string): Promise<{ exists: boolean; data?: any }> {
  if (!db) return { exists: false };
  const em = userDocIdForEmail(email);

  const emailRef = doc(db, 'users', em);
  const emailSnap = await getDoc(emailRef);
  if (emailSnap.exists()) return { exists: true, data: emailSnap.data() };

  // Legacy fallback: older builds stored user profile with a random/uid doc id.
  // This requires query/list permissions; if rules deny it, we simply fall back to the canonical doc.
  try {
    const q = query(collection(db, 'users'), where('email', '==', em), limit(1));
    const qs = await getDocs(q);
    const legacy = qs.docs[0];
    if (!legacy) return { exists: false };

    // Migrate legacy data to canonical doc id = email. Do not delete legacy doc from client.
    await setDoc(emailRef, legacy.data(), { merge: true });
    const migrated = await getDoc(emailRef);
    return migrated.exists() ? { exists: true, data: migrated.data() } : { exists: false };
  } catch {
    return { exists: false };
  }
}

/**
 * Use after Firebase `signInWithEmailAndPassword`. Reads `users/{email}` (owner can `get`).
 * Do not use `getActivationKeyByEmail` before sign-in — listing/querying `licenses` is admin-only in rules.
 */
export async function getLicenseKeyFromUserProfile(email: string): Promise<{
  licenseKey: string;
  profile: Record<string, unknown>;
} | null> {
  if (!db || !auth?.currentUser) return null;
  const em = userDocIdForEmail(email);
  const tokenEmail = userDocIdForEmail(String(auth.currentUser.email ?? ''));
  if (!em || em !== tokenEmail) return null;

  try {
    const ensured = await ensureUserProfileByEmail(em);
    if (!ensured.exists || !ensured.data) return null;
    const data = ensured.data as Record<string, unknown>;
    const licenseKey = String(data?.licenseKey ?? '').trim().toUpperCase();
    if (!licenseKey) return null;
    return { licenseKey, profile: data };
  } catch {
    return null;
  }
}

function asHttpsError(err: any): { code?: string; message?: string } {
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '');
  return { code, message };
}

function requireFunctions() {
  if (!functions) throw new Error('Firebase not configured');
  return functions;
}

export async function callActivateLicense(params: { licenseKey: string; deviceId: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'activateLicense');
  const res = await fn({ licenseKey: params.licenseKey, deviceId: params.deviceId });
  return res.data as any;
}

export async function callValidateLicense(params: { licenseKey: string; deviceId: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'validateLicense');
  const res = await fn({ licenseKey: params.licenseKey, deviceId: params.deviceId });
  return res.data as any;
}

export async function callTransferLicense(params: { licenseKey: string; deviceId: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'transferLicense');
  const res = await fn({ licenseKey: params.licenseKey, deviceId: params.deviceId });
  return res.data as any;
}

async function callSurrenderLicense(params: { licenseKey: string; deviceId: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'surrenderLicense');
  const res = await fn({ licenseKey: params.licenseKey, deviceId: params.deviceId });
  return res.data as any;
}

export async function callSubmitMultiUserUpgrade(params: { licenseKey?: string; utr: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'submitMultiUserUpgrade');
  const res = await fn({ licenseKey: params.licenseKey ?? '', utr: params.utr.trim() });
  return res.data as { ok: boolean; requestId?: string };
}

export async function callGetMyMultiUserUpgradeStatus(params?: { licenseKey?: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'getMyMultiUserUpgradeStatus');
  const res = await fn({ licenseKey: params?.licenseKey ?? '' });
  return res.data as { ok: boolean; item: any | null; items?: any[] };
}

export async function callSubmitGatewayRenewal(params: { licenseKey?: string; utr: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'submitGatewayRenewal');
  const res = await fn({ licenseKey: params.licenseKey ?? '', utr: params.utr.trim() });
  return res.data as { ok: boolean; requestId?: string };
}

export async function callGetMyGatewayRenewalStatus(params?: { licenseKey?: string }) {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'getMyGatewayRenewalStatus');
  const res = await fn({ licenseKey: params?.licenseKey ?? '' });
  return res.data as { ok: boolean; item: any | null; items?: any[] };
}

/** LOCAL ONLY — read Firestore license doc / profile; refresh encrypted cache (no validateLicense CF). */
export async function refreshMultiUserLanInCache(): Promise<{
  multiUserLan: boolean;
  licenseKey: string | null;
  gatewayValidUntilMs: number | null;
  gatewayUpdatesEntitled: boolean;
}> {
  if (!auth || !auth.currentUser) {
    return { multiUserLan: false, licenseKey: null, gatewayValidUntilMs: null, gatewayUpdatesEntitled: false };
  }
  const email = normalizeEmail(String(auth.currentUser.email ?? ''));
  if (!email) {
    return { multiUserLan: false, licenseKey: null, gatewayValidUntilMs: null, gatewayUpdatesEntitled: false };
  }

  const deviceId = await getDeviceId();
  const cached = (await readLocalLicenseCache(deviceId)) ?? {};
  let licenseKey = String(cached.licenseKey || cached.activationKey || '').trim();

  try {
    const ensured = await ensureUserProfileByEmail(email);
    const profileKey = String((ensured.data as any)?.licenseKey ?? '').trim();
    if (profileKey) licenseKey = profileKey;
  } catch {
    // use cached key offline
  }

  if (!licenseKey) {
    return { multiUserLan: false, licenseKey: null, gatewayValidUntilMs: null, gatewayUpdatesEntitled: false };
  }

  let multiUserLan = Boolean(cached.multiUserLan);
  let gatewayValidUntilMs =
    cached.gatewayValidUntilMs != null ? Number(cached.gatewayValidUntilMs) : null;
  let gatewayUpdatesEntitled = Boolean(cached.gatewayUpdatesEntitled);

  if (db && navigator.onLine) {
    try {
      const licSnap = await getDoc(doc(db, 'licenses', licenseKey.trim().toUpperCase()));
      if (licSnap.exists()) {
        const data = licSnap.data() as Record<string, unknown>;
        multiUserLan = Boolean(data.multiUserLan);
        gatewayValidUntilMs =
          data.gatewayValidUntilMs != null ? Number(data.gatewayValidUntilMs) : gatewayValidUntilMs;
        gatewayUpdatesEntitled = Boolean(data.gatewayUpdatesEntitled);
      }
    } catch {
      // offline or rules — keep cached flags
    }
  }

  try {
    await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, {
      ...cached,
      uid: auth.currentUser.uid,
      email,
      licenseKey,
      multiUserLan,
      gatewayValidUntilMs,
      gatewayUpdatesEntitled,
      cachedAt: Date.now(),
      ...(cached.permanently_activated ? {} : permanentCacheFields(deviceId, cached.activated_at)),
    });
  } catch {
    // ignore cache write failures
  }

  return { multiUserLan, licenseKey, gatewayValidUntilMs, gatewayUpdatesEntitled };
}

/** Verify activation key via Cloud Function (handles all license doc structures) */
export async function callVerifyActivationForLogin(params: {
  licenseKey: string;
}): Promise<{ ok: boolean; licenseKey: string; assignedToEmail?: string; expiryDateMs?: number }> {
  const fns = requireFunctions();
  const fn = httpsCallable(fns, 'verifyActivationForLogin');
  const res = await fn({ licenseKey: params.licenseKey });
  return res.data as any;
}

export async function validateLicenseForEmail(licenseKey: string, email: string): Promise<LicenseValidationResult> {
  void email;
  if (!licenseKey.trim()) return { ok: false, reason: 'License key required' };
  return { ok: true };
}

export async function activateAccountWithLicense(params: {
  name: string;
  businessName: string;
  email: string;
  mobile: string;
  password: string;
  licenseKey: string;
}): Promise<{ ok: boolean; reason?: string; type?: 'DEVICE_ALREADY_BOUND' | 'NO_LICENSE' | 'OTHER' }> {
  if (!auth || !db) return { ok: false, reason: 'Firebase not configured' };

  const email = normalizeEmail(params.email);
  const licenseKey = params.licenseKey.trim();

  // Create/sign-in the user first. Some Firestore rules require authentication for reads/updates.
  let cred: any;
  let createdNewUser = false;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, params.password);
    createdNewUser = true;
    // Ensure Firestore sees the authenticated session immediately.
    await cred.user.getIdToken(true);
  } catch (e: any) {
    const code = String(e?.code ?? '');
    if (code.includes('email-already-in-use')) {
      // If the auth account already exists, sign in and continue activation to create the missing profile.
      try {
        cred = await signInWithEmailAndPassword(auth, email, params.password);
        await cred.user.getIdToken(true);
      } catch (e2: any) {
        const c2 = String(e2?.code ?? '');
        if (c2.includes('invalid-credential') || c2.includes('invalid-login-credentials') || c2.includes('wrong-password')) {
          return { ok: false, reason: 'This email is already registered. Please enter the correct password (or use Forgot password) and try again.' };
        }
        return { ok: false, reason: e2?.message ?? 'Account already exists. Please login.' };
      }
    } else {
      return { ok: false, reason: e?.message ?? 'Activation failed' };
    }
  }

  const rollbackNewUser = async () => {
    if (createdNewUser) {
      try {
        const u = auth.currentUser;
        if (u) {
          await u.delete();
        }
      } catch {
        // ignore
      }
    }
    try {
      await auth.signOut();
    } catch {
      // ignore
    }
  };

  try {
    const deviceId = await getDeviceId();
    const now = serverTimestamp();
    const normalizedKey = licenseKey.trim().toUpperCase();
    try {
      const licSnap = await getDoc(doc(db, 'licenses', normalizedKey));
      if (!licSnap.exists()) {
        await rollbackNewUser();
        return {
          ok: false,
          reason: `License key not found in database (${normalizedKey}). Check the key from Admin or generate a new one.`,
          type: 'NO_LICENSE',
        };
      }
    } catch (e: any) {
      const code = String(e?.code ?? '');
      if (code.includes('permission-denied')) {
        await rollbackNewUser();
        return {
          ok: false,
          reason: 'Cannot read license (Firestore rules). Publish desktop/firestore.rules (unassigned license read) and retry.',
          type: 'OTHER',
        };
      }
    }

    let activation: any;
    try {
      activation = await callActivateLicense({ licenseKey: normalizedKey, deviceId });
      if (!activation?.ok) {
        await rollbackNewUser();
        
        // Better error handling based on activation response
        if (activation?.code === 'failed-precondition') {
          return { 
            ok: false, 
            reason: 'This license is already activated on another device. Please contact support to transfer the license.',
            type: 'DEVICE_ALREADY_BOUND'
          };
        } else if (activation?.code === 'not-found') {
          return { 
            ok: false, 
            reason: 'No license found for this activation key.',
            type: 'NO_LICENSE'
          };
        } else {
          return { 
            ok: false, 
            reason: activation?.message || 'License activation failed',
            type: 'OTHER'
          };
        }
      }
    } catch (e: any) {
      await rollbackNewUser();
      const he = asHttpsError(e);
      const code = he.code ? ` (${he.code})` : '';
      
      // Better error classification
      if (he.code === 'failed-precondition') {
        return { 
          ok: false, 
          reason: 'This license is already activated on another device. Please contact support to transfer the license.',
          type: 'DEVICE_ALREADY_BOUND'
        };
      } else if (he.code === 'not-found') {
        return { 
          ok: false, 
          reason: 'No license found for this activation key.',
          type: 'NO_LICENSE'
        };
      } else {
        return { 
          ok: false, 
          reason: `License activation failed${code}: ${he.message || e?.message || 'permission denied'}`,
          type: 'OTHER'
        };
      }
    }

    const expiryDate = activation?.expiryDateMs ? Timestamp.fromMillis(Number(activation.expiryDateMs)) : null;

    const profile: UserProfileDoc = {
      name: params.name.trim(),
      businessName: params.businessName.trim(),
      email,
      mobile: params.mobile.trim(),

      licenseKey,
      deviceId,
      completedBusinessProfile: false,
      address: '',
      state: '',
      gstNumber: '',
      licenseExpiry: expiryDate,

      createdAt: now as any,
      lastLogin: now as any,
    };

    try {
      await setDoc(doc(db, 'users', userDocIdForEmail(email)), profile, { merge: true });
    } catch (e: any) {
      await rollbackNewUser();
      const code = String(e?.code ?? '');
      return { ok: false, reason: `User profile write failed${code ? ` (${code})` : ''}: ${e?.message ?? 'permission denied'}` };
    }

    // Encrypted local cache (token + license details)
    const token = await cred.user.getIdToken();
    await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, {
      uid: cred.user.uid,
      email,
      token,
      licenseKey,
      licenseExpiry: expiryDate ? expiryDate.toMillis() : null,
      cachedAt: Date.now(),
      ...permanentCacheFields(deviceId),
    });

    // Bind device to prevent future tampering
    await bindCurrentDevice(email);

    await clearTrialStartDate();

    // ❌ SECURITY FIX: Never store passwords in Firestore
    // Firebase Authentication handles password storage securely
    // Remove any password sync to Firestore for security

    return { ok: true };
  } catch (e: any) {
    await rollbackNewUser();
    return { ok: false, reason: e?.message ?? 'Activation failed' };
  }
}

// 🔥 Direct activation key verification from Firestore
// Licenses are stored at documents/licenses/{licenseKey} with doc ID = licenseKey (uppercase).
// Firestore rules: get is allowed for signed-in users when assignedToEmail matches.
// Query/list requires admin, so we use getDoc by document ID.
export async function verifyActivationKey(activationKey: string, emailId: string): Promise<{
  status: 'activated' | 'not_activated' | 'not_found' | 'error';
  allowLogin: boolean;
  reason?: string;
  licenseData?: any;
}> {
  try {
    if (!db) {
      return { status: 'error', allowLogin: false, reason: 'Firestore not available' };
    }

    const normalizedKey = activationKey.trim().toUpperCase();
    console.log('🔍 Querying Firestore for activation key:', normalizedKey);
    console.log('🔍 Email:', emailId);

    // Use getDoc by document ID (licenses/{licenseKey}) - matches Cloud Functions structure
    const licRef = doc(db, 'licenses', normalizedKey);
    const licenseSnap = await getDoc(licRef);

    if (!licenseSnap.exists()) {
      console.log('❌ License key not found in Firestore');
      return { status: 'not_found', allowLogin: false, reason: 'License key not found' };
    }

    const licenseData = licenseSnap.data();
    
    console.log('🔍 License data found:', licenseData);

    const assignedEmail = normalizeEmail(String(licenseData.assignedToEmail || ''));
    const normalizedProvidedEmail = normalizeEmail(emailId);

    if (assignedEmail && assignedEmail !== normalizedProvidedEmail) {
      console.log('❌ License assigned to different email:', assignedEmail, 'vs', normalizedProvidedEmail);
      return {
        status: 'not_activated',
        allowLogin: false,
        reason: `License assigned to different email: ${assignedEmail}`,
      };
    }

    // Pending key (no email yet) — not an error; caller should run activateLicense.
    if (!assignedEmail) {
      return {
        status: 'not_activated',
        allowLogin: false,
        reason: 'License not activated yet. Use Activate License.',
        licenseData,
      };
    }

    const isActive = Boolean(licenseData.isActive);

    if (!isActive) {
      console.log('❌ License is not active');
      return { status: 'not_activated', allowLogin: false, reason: 'License is not active' };
    }

    // Check if license has expired
    if (licenseData.expiryDate) {
      const expiryDate = licenseData.expiryDate.toDate ? licenseData.expiryDate.toDate() : new Date(licenseData.expiryDate);
      if (expiryDate < new Date()) {
        console.log('❌ License has expired:', expiryDate);
        return { status: 'not_activated', allowLogin: false, reason: 'License has expired' };
      }
    }

    console.log('✅ License is valid and active');
    return { 
      status: 'activated', 
      allowLogin: true, 
      reason: 'License is valid and active',
      licenseData
    };

  } catch (error: any) {
    console.error('❌ Error verifying activation key:', error);
    const code = String(error?.code ?? '');
    if (code.includes('permission-denied')) {
      return {
        status: 'error',
        allowLogin: false,
        reason: 'Cannot read license (Firestore rules). Deploy updated firestore.rules and retry.',
      };
    }
    return {
      status: 'error',
      allowLogin: false,
      reason: `Error verifying license: ${error.message}`,
    };
  }
}

// 🔥 NEW: Device Transfer and Management Functions
export async function checkDeviceTransfer(activationKey: string, emailId: string, newDeviceId: string): Promise<{
  needsTransfer: boolean;
  oldDeviceInfo?: any;
  allowSurrender: boolean;
  reason?: string;
}> {
  try {
    if (!db) {
      return { needsTransfer: false, allowSurrender: false, reason: 'Firestore not available' };
    }

    console.log('🔍 Checking device transfer for key:', activationKey);
    console.log('🔍 Email:', emailId);
    console.log('🔍 New Device ID:', newDeviceId);

    // Use getDoc by document ID (licenses/{licenseKey})
    const normalizedKey = activationKey.trim().toUpperCase();
    const licRef = doc(db, 'licenses', normalizedKey);
    const licenseSnap = await getDoc(licRef);

    if (!licenseSnap.exists()) {
      return { needsTransfer: false, allowSurrender: false, reason: 'License not found' };
    }

    const licenseData = licenseSnap.data();
    const assignedEmail = normalizeEmail(String(licenseData.assignedToEmail || ''));
    const normalizedProvidedEmail = normalizeEmail(emailId);

    if (assignedEmail !== normalizedProvidedEmail) {
      return {
        needsTransfer: false,
        allowSurrender: false,
        reason: `License assigned to different email: ${assignedEmail}`,
      };
    }

    // Check if license is active
    if (!Boolean(licenseData.isActive)) {
      return { needsTransfer: false, allowSurrender: false, reason: 'License is not active' };
    }

    // Check expiry
    if (licenseData.expiryDate) {
      const expiryDate = licenseData.expiryDate.toDate ? licenseData.expiryDate.toDate() : new Date(licenseData.expiryDate);
      if (expiryDate < new Date()) {
        return { needsTransfer: false, allowSurrender: false, reason: 'License has expired' };
      }
    }

    const devices = (licenseData.devices || {}) as Record<string, { activatedAt?: unknown; lastSeenAt?: unknown; lastSeen?: unknown }>;
    const newDKey = await computeLicenseDeviceKey(newDeviceId);
    const hasThisDevice = Boolean(devices[newDKey] || devices[newDeviceId]);

    if (hasThisDevice) {
      return { needsTransfer: false, allowSurrender: false };
    }

    const legacyCurrent = String(licenseData.currentDeviceId || '').trim();
    if (legacyCurrent && legacyCurrent !== newDeviceId) {
      return {
        needsTransfer: true,
        oldDeviceInfo: {
          deviceId: legacyCurrent,
          activatedAt: licenseData.activatedAt,
          lastSeen: licenseData.lastSeen,
        },
        allowSurrender: true,
        reason: 'License is active on another device',
      };
    }

    const deviceKeys = Object.keys(devices).filter((k) => devices[k]);
    if (deviceKeys.length > 0) {
      const oldKey = deviceKeys[0];
      const slot = devices[oldKey];
      return {
        needsTransfer: true,
        oldDeviceInfo: {
          deviceId: oldKey,
          activatedAt: slot?.activatedAt,
          lastSeen: slot?.lastSeenAt ?? slot?.lastSeen,
        },
        allowSurrender: true,
        reason: 'License is bound to another device — transfer to this PC to continue',
      };
    }

    return { needsTransfer: false, allowSurrender: false };
  } catch (error: any) {
    console.error('❌ Error checking device transfer:', error);
    return {
      needsTransfer: false,
      allowSurrender: false,
      reason: `Error checking transfer: ${error.message}`,
    };
  }
}

/**
 * Moves the license binding to this device via Cloud Function `transferLicense`.
 * Clients cannot write `licenses/*` (Firestore rules) — server replaces old device entries.
 */
export async function surrenderOldDevice(
  activationKey: string,
  _emailId: string,
  _oldDeviceId: string,
  newDeviceId: string
): Promise<{
  success: boolean;
  reason?: string;
  expiryDateMs?: number | null;
}> {
  void _emailId;
  void _oldDeviceId;
  try {
    const normalizedKey = activationKey.trim().toUpperCase();
    console.log('🔄 transferLicense callable — new device:', newDeviceId);
    const data = await callTransferLicense({ licenseKey: normalizedKey, deviceId: newDeviceId });
    if (!data?.ok) {
      return { success: false, reason: 'Transfer rejected by server' };
    }
    return {
      success: true,
      expiryDateMs: data.expiryDateMs != null ? Number(data.expiryDateMs) : null,
    };
  } catch (error: any) {
    console.error('❌ Error surrendering old device:', error);
    const he = asHttpsError(error);
    return {
      success: false,
      reason: he.message || error?.message || 'Transfer failed',
    };
  }
}

// 🔥 IMPROVED: Get activation key by user email with better debugging
export async function getActivationKeyByEmail(emailId: string): Promise<{
  found: boolean;
  activationKey?: string;
  licenseData?: any;
  reason?: string;
}> {
  try {
    if (!db) {
      return { found: false, reason: 'Firestore not available' };
    }

    const normalizedEmail = emailId.trim().toLowerCase();

    console.log('🔍 Searching for license by email:', normalizedEmail);

    // Query licenses collection
    const licensesRef = collection(db, 'licenses');
    
    // Try multiple query strategies
    const queries = [
      // Strategy 1: Direct assignedToEmail match
      query(licensesRef, where('assignedToEmail', '==', normalizedEmail), limit(1)),
      
      // Strategy 2: Try original case (in case normalization is the issue)
      query(licensesRef, where('assignedToEmail', '==', emailId.trim()), limit(1)),
      
      // Strategy 3: Try email field (some licenses might use 'email' instead)
      query(licensesRef, where('email', '==', normalizedEmail), limit(1)),
    ];

    // Try each query strategy
    for (let i = 0; i < queries.length; i++) {
      console.log(`🔍 Trying query strategy ${i + 1}...`);
      
      try {
        const snapshot = await getDocs(queries[i]);
        
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const licenseData = docSnap.data();
          const activationKey = docSnap.id;

          console.log('✅ Found license document:', activationKey);
          console.log('🔍 License data:', JSON.stringify(licenseData, null, 2));

          return {
            found: true,
            activationKey,
            licenseData,
          };
        }
      } catch (queryError: any) {
        console.log(`⚠️ Query strategy ${i + 1} failed:`, queryError.message);
        // Continue to next strategy
      }
    }

    // If all queries fail, try to list all licenses to help debug
    console.log('❌ No license found with any query strategy');
    console.log('🔍 Attempting to list all licenses for debugging...');
    
    try {
      const allLicensesSnapshot = await getDocs(query(licensesRef, limit(5)));
      if (!allLicensesSnapshot.empty) {
        console.log('📋 Sample licenses in database:');
        allLicensesSnapshot.docs.forEach((doc, idx) => {
          const data = doc.data();
          console.log(`  License ${idx + 1}:`, {
            id: doc.id,
            assignedToEmail: data.assignedToEmail,
            email: data.email,
            status: data.status,
            isActive: data.isActive,
          });
        });
      } else {
        console.log('⚠️ No licenses found in the database at all');
      }
    } catch (listError) {
      console.log('⚠️ Could not list licenses (may be a permissions issue):', listError);
    }

    return { 
      found: false, 
      reason: `No license found for email: ${normalizedEmail}. Please activate your account first.` 
    };

  } catch (error: any) {
    console.error('❌ Error fetching license:', error);
    return {
      found: false,
      reason: error.message || 'Error fetching license',
    };
  }
}

// 🔥 NEW: Validate license for login with comprehensive checks
export async function validateLicenseForLogin(
  emailId: string
): Promise<{ 
  valid: boolean; 
  activationKey?: string; 
  reason?: string;
  requiresActivation?: boolean;
  licenseData?: any;
}> {
  console.log('🔐 Starting license validation for:', emailId);
  
  // First, check if the license exists
  const licenseResult = await getActivationKeyByEmail(emailId);
  
  if (!licenseResult.found) {
    console.log('❌ No license found for this email');
    return {
      valid: false,
      reason: 'No license found for this email. Please activate your account.',
      requiresActivation: true
    };
  }

  console.log('✅ License found:', licenseResult.activationKey);
  
  // Check if license is valid/active
  const licenseData = licenseResult.licenseData;
  
  // Check if license is active (check both 'status' and 'isActive' fields)
  const isActive = licenseData.status === 'active' || Boolean(licenseData.isActive);
  if (!isActive) {
    console.log('❌ License not active. Status:', licenseData.status, 'isActive:', licenseData.isActive);
    return {
      valid: false,
      activationKey: licenseResult.activationKey,
      reason: `License status: ${licenseData.status || 'inactive'}. Please contact support.`,
      licenseData
    };
  }
  
  // Check expiry
  if (licenseData.expiryDate) {
    const expiryDate = licenseData.expiryDate.toDate ? licenseData.expiryDate.toDate() : new Date(licenseData.expiryDate);
    const now = new Date();
    
    if (expiryDate < now) {
      console.log('❌ License expired:', expiryDate);
      return {
        valid: false,
        activationKey: licenseResult.activationKey,
        reason: 'Your license has expired. Please renew your subscription.',
        licenseData
      };
    }
  }

  console.log('✅ License validation successful');
  return {
    valid: true,
    activationKey: licenseResult.activationKey,
    licenseData
  };
}

/** CLOUD CALL #3 internal — only invoked from verifyLicenseOnlineManual (Settings). */
export async function validateOnLoginOrStart(): Promise<LicenseGateResult> {
  if (!auth || !db) return { ok: false, reason: 'Firebase not configured' };
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'Not logged in' };

  try {
    const token = await withTimeout(user.getIdToken(true), 8000, null);
    if (!token) {
      return { ok: false, reason: 'Login session timed out. Sign in again.' };
    }
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'Login required' };
  }

  const email = normalizeEmail(String(user.email ?? ''));
  if (!email) return { ok: false, reason: 'Email missing in session' };

  let profile: any;
  try {
    const ensured = await ensureUserProfileByEmail(email);
    if (!ensured.exists) return { ok: false, reason: 'User profile missing', action: 'activation_required' };
    profile = ensured.data ?? {};
  } catch (e: any) {
    const code = String(e?.code ?? '');
    return {
      ok: false,
      reason: `User profile read failed${code ? ` (${code})` : ''}: ${e?.message ?? 'permission denied'}`,
    };
  }

  const typedProfile = profile as UserProfileDoc;
  const licenseKey = String((typedProfile as any).licenseKey ?? '').trim();
  if (!licenseKey) return { ok: false, reason: 'No license assigned', action: 'activation_required' };

  const deviceId = await getDeviceId();
  let validated: any;
  try {
    validated = await callValidateLicense({ licenseKey, deviceId });
  } catch (e: any) {
    const he = asHttpsError(e);
    const msg = he.message || e?.message || 'permission denied';

    if (String(he.code).includes('not-found')) {
      return { ok: false, reason: `License not found`, licenseKey };
    }
    if (String(he.code).includes('permission-denied')) {
      return { ok: false, reason: msg || 'License assigned to another email', licenseKey };
    }
    if (String(he.code).includes('failed-precondition') && msg.toLowerCase().includes('expired')) {
      return { ok: false, reason: 'License expired', action: 'expired', licenseKey };
    }

    // If the device isn't activated, try server-side activation. If that hits activation limit,
    // the UI should prompt for a transfer.
    if (String(he.code).includes('failed-precondition') && msg.toLowerCase().includes('device not activated')) {
      try {
        validated = await callActivateLicense({ licenseKey, deviceId });
      } catch (e2: any) {
        const he2 = asHttpsError(e2);
        const msg2 = he2.message || e2?.message || 'activation failed';
        if (String(he2.code).includes('failed-precondition') && msg2.toLowerCase().includes('activation limit')) {
          return {
            ok: false,
            reason: 'License already active on another device',
            action: 'transfer_required',
            licenseKey,
            newDeviceId: deviceId,
          };
        }
        return { ok: false, reason: msg2, licenseKey };
      }
    } else {
      return { ok: false, reason: msg, licenseKey };
    }
  }

  const now = serverTimestamp();
  try {
    await updateDoc(doc(db, 'users', userDocIdForEmail(email)), {
      lastLogin: now,
      lastActiveAt: now,
      deviceId,
      appVersion: getBundledAppVersion(),
      gatewayValidUntilMs:
        validated?.gatewayValidUntilMs != null ? Number(validated.gatewayValidUntilMs) : null,
      gatewayUpdatesEntitled: Boolean(validated?.gatewayUpdatesEntitled),
    });
  } catch (e: any) {
    const code = String(e?.code ?? '');
    return {
      ok: false,
      reason: `User profile update failed${code ? ` (${code})` : ''}: ${e?.message ?? 'permission denied'}`,
      licenseKey,
    };
  }
  const token = await user.getIdToken();
  const exp = validated?.expiryDateMs ? Timestamp.fromMillis(Number(validated.expiryDateMs)) : null;
  const multiUserLan = Boolean(validated?.multiUserLan);
  const verifyIso = new Date().toISOString();
  await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, deviceId, {
    uid: user.uid,
    email,
    token,
    licenseKey,
    licenseExpiry: exp ? exp.toMillis() : null,
    cachedAt: Date.now(),
    multiUserLan,
    last_online_verify_at: verifyIso,
    ...permanentCacheFields(deviceId),
  });

  // Bind/update device binding on successful validation
  await bindCurrentDevice(email);

  return {
    ok: true,
    licenseKey,
    completedBusinessProfile: Boolean((typedProfile as any)?.completedBusinessProfile),
    multiUserLan,
  };
}

export async function transferLicenseToThisDevice(params: { licenseKey: string; email: string }): Promise<void> {
  void params.email;
  if (!auth) throw new Error('Firebase not configured');
  if (!auth.currentUser) throw new Error('Not logged in');
  const licenseKey = params.licenseKey.trim();
  const deviceId = await getDeviceId();
  await callTransferLicense({ licenseKey, deviceId });
  
  // Bind new device after successful transfer
  await bindCurrentDevice(params.email);
}

export async function surrenderLicense(params: { email: string; password: string; licenseKey: string }): Promise<void> {
  if (!auth || !db) throw new Error('Firebase not configured');
  const email = normalizeEmail(params.email);
  const password = params.password;
  const licenseKey = params.licenseKey.trim();
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');

  const cred = EmailAuthProvider.credential(email, password);
  await reauthenticateWithCredential(user, cred);

  const deviceId = await getDeviceId();
  await callSurrenderLicense({ licenseKey, deviceId });
  
  // Clear device binding after surrender
  clearDeviceBinding();
}