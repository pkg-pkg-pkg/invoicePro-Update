import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { CloudCompanyDetails } from './companyDetailsCloudService';
import {
  restoreCompanyDetailsFromCloud,
  saveCompanyDetailsToCloud,
} from './companyDetailsCloudService';
import { logProfileDebugEvent, scanProfilePersistenceDebug } from './businessProfileDebugService';
import { isElectronRuntime } from '../utils/runtime';
import {
  getProfileCompletionStatus,
  markCompanyProfileCompleted,
  normalizedToUpsertPayload,
  preloadCompanyProfile,
  upsertCompanyProfile,
} from './companyProfileDbService';

const LOCAL_PROFILE_COMPLETE_KEY = 'pve_business_profile_completed';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function markLocalBusinessProfileComplete(): void {
  try {
    localStorage.setItem(LOCAL_PROFILE_COMPLETE_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export function isLocalBusinessProfileComplete(): boolean {
  try {
    return localStorage.getItem(LOCAL_PROFILE_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function hasBusinessProfileInLocalData(_data: Record<string, string>): boolean {
  return false;
}

export function isBusinessProfileSavedLocally(): boolean {
  if (isElectronRuntime()) {
    return false;
  }
  try {
    return localStorage.getItem('setupCompleted') === 'true';
  } catch {
    return false;
  }
}

export function pickBusinessProfileLocalSnapshot(
  _data: Record<string, string>
): Record<string, string> {
  return {};
}

function isCloudProfileComplete(cloud: CloudCompanyDetails): boolean {
  const name = String(cloud.companyName || cloud.businessName || '').trim();
  const address = String(cloud.address || '').trim();
  const phone = String(cloud.phone || '').trim();
  return Boolean(name && address && phone);
}

export async function applyCloudCompanyDetailsToDb(cloud: CloudCompanyDetails): Promise<void> {
  const extra = cloud as Record<string, unknown>;
  const businessName = String(cloud.companyName || extra.businessName || '').trim();
  const payload = normalizedToUpsertPayload({
    businessName,
    name: businessName,
    ownerName: String(extra.ownerName || extra.name || '').trim(),
    address: String(cloud.address || extra.address || '').trim(),
    city: String(extra.city || '').trim(),
    state: String(extra.state || '').trim(),
    pinCode: String(extra.pinCode || '').trim(),
    phone: String(cloud.phone || extra.phone || '').trim(),
    email: String(cloud.email || extra.email || '').trim(),
    gstin: String(extra.gstNumber || cloud.gstNumber || '').trim(),
    pan: String(extra.panNumber || cloud.panNumber || '').trim(),
    bank: String(extra.bankName || '').trim(),
    accountNo: String(extra.bankAccountNumber || '').trim(),
    ifsc: String(extra.bankIfsc || '').trim(),
    bankBranch: String(extra.bankBranch || '').trim(),
  }, { markCompleted: isCloudProfileComplete(cloud) });

  await upsertCompanyProfile(payload);
  if (isCloudProfileComplete(cloud)) {
    await markCompanyProfileCompleted(businessName);
    markLocalBusinessProfileComplete();
  }
  await preloadCompanyProfile();
  window.dispatchEvent(new Event('companyProfileUpdated'));
}

/** @deprecated Use applyCloudCompanyDetailsToDb */
export function applyCloudCompanyDetailsToLocalStorage(cloud: CloudCompanyDetails): void {
  void applyCloudCompanyDetailsToDb(cloud);
}

export async function fetchBusinessProfileCompletedFromFirestore(email: string): Promise<boolean> {
  if (!db) return false;
  const emailId = normalizeEmail(email);
  if (!emailId) return false;
  const snap = await getDoc(doc(db, 'users', emailId)).catch(() => null);
  if (!snap?.exists()) return false;
  return Boolean((snap.data() as { completedBusinessProfile?: boolean })?.completedBusinessProfile);
}

export async function markBusinessProfileCompleteInFirestore(email: string): Promise<void> {
  if (!db) return;
  const emailId = normalizeEmail(email);
  if (!emailId) return;
  await setDoc(
    doc(db, 'users', emailId),
    {
      completedBusinessProfile: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function isBusinessProfileCompleteOnDb(): Promise<boolean> {
  if (isLocalBusinessProfileComplete()) return true;
  if (!isElectronRuntime()) return isBusinessProfileSavedLocally();
  const status = await getProfileCompletionStatus();
  const complete = Boolean(status.profileCompleted ?? status.PROFILE_COMPLETED);
  if (complete) markLocalBusinessProfileComplete();
  return complete;
}

/** Restore cloud profile to SQLite and sync Firebase completion flag. */
export async function syncBusinessProfileOnLogin(email: string): Promise<boolean> {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) return false;

  let completed = await fetchBusinessProfileCompletedFromFirestore(emailNorm);

  if (isElectronRuntime()) {
    const dbComplete = await isBusinessProfileCompleteOnDb();
    if (dbComplete) {
      markLocalBusinessProfileComplete();
      await logProfileDebugEvent('sync_on_login_db_hit', { email: emailNorm });
      if (!completed) {
        try {
          await markBusinessProfileCompleteInFirestore(emailNorm);
        } catch {
          // Offline
        }
      }
      return true;
    }

    const cloud = await restoreCompanyDetailsFromCloud(emailNorm).catch(() => null);
    if (cloud && isCloudProfileComplete(cloud)) {
      await applyCloudCompanyDetailsToDb(cloud);
      await logProfileDebugEvent('sync_on_login_cloud_restore', { email: emailNorm });
      if (!completed) {
        try {
          await markBusinessProfileCompleteInFirestore(emailNorm);
        } catch {
          // Offline
        }
      }
      return true;
    }

    await logProfileDebugEvent('sync_on_login_incomplete', {
      email: emailNorm,
      firestoreFlag: completed,
      dbComplete: false,
    });
    await scanProfilePersistenceDebug();
    return false;
  }

  if (isBusinessProfileSavedLocally()) {
    if (!completed) {
      try {
        await markBusinessProfileCompleteInFirestore(emailNorm);
      } catch {
        // Offline
      }
    }
    return true;
  }

  const cloud = await restoreCompanyDetailsFromCloud(emailNorm).catch(() => null);
  if (cloud && isCloudProfileComplete(cloud)) {
    applyCloudCompanyDetailsToLocalStorage(cloud);
    if (!completed) {
      try {
        await markBusinessProfileCompleteInFirestore(emailNorm);
      } catch {
        // Offline
      }
    }
    return true;
  }

  return completed && isBusinessProfileSavedLocally();
}

export async function finalizeBusinessProfileSave(input: {
  email: string;
  companyName: string;
  phone: string;
  address: string;
  companyInfo: Record<string, unknown>;
}): Promise<void> {
  const payload = normalizedToUpsertPayload({
    ...input.companyInfo,
    businessName: input.companyName,
    name: input.companyName,
    phone: input.phone,
    address: input.address,
  }, { markCompleted: true });

  const upsertResult = await upsertCompanyProfile(payload);
  if (!upsertResult.success) {
    throw new Error(upsertResult.error || 'Failed to save profile to database');
  }

  const markResult = await markCompanyProfileCompleted(input.companyName);
  if (!markResult.success) {
    throw new Error(markResult.error || 'Failed to mark profile complete');
  }

  markLocalBusinessProfileComplete();

  await preloadCompanyProfile();
  window.dispatchEvent(new Event('companyProfileUpdated'));

  try {
    await saveCompanyDetailsToCloud({
      email: input.email,
      companyName: input.companyName,
      phone: input.phone,
      address: input.address,
      extra: input.companyInfo,
    });
  } catch (cloudError) {
    console.error('Failed to sync company profile to cloud:', cloudError);
  }

  try {
    await markBusinessProfileCompleteInFirestore(input.email);
  } catch (firestoreError) {
    console.error('Failed to mark business profile complete in Firestore:', firestoreError);
  }

  await logProfileDebugEvent('save_finalize_db', {
    email: input.email,
    companyName: input.companyName,
    upsertResult,
    markResult,
  });
  await scanProfilePersistenceDebug();
}
