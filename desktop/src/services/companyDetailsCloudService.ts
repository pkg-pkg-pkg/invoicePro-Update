import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getDeviceId } from './deviceService';

export interface CloudCompanyDetails {
  companyName: string;
  email: string;
  phone?: string;
  address?: string;
  licenseKey?: string;
  activatedAt?: any;
  deviceId?: string;
  lastLoginDevice?: string;
  lastLoginAt?: any;
  isTransferred?: boolean;
  transferCount?: number;
  [key: string]: any;
}

const COMPANY_COLLECTION = 'Company-Details';
const ARCHIVE_COLLECTION = 'Archived-Companies';

function getLocalLicenseKey(): string | undefined {
  try {
    const raw = localStorage.getItem('gst_billing_users');
    if (!raw) return undefined;
    const users = JSON.parse(raw) as any[];
    const u = users[0];
    return u?.activationKey ? String(u.activationKey) : undefined;
  } catch {
    return undefined;
  }
}

function buildCompanyDocumentId(email: string): string {
  return email.trim().toLowerCase();
}

export async function saveCompanyDetailsToCloud(input: {
  email: string;
  companyName: string;
  phone?: string;
  address?: string;
  extra?: Record<string, any>;
}): Promise<void> {
  if (!db) return;

  const emailId = buildCompanyDocumentId(input.email);
  if (!emailId) return;

  const deviceId = await getDeviceId().catch(() => '');
  const licenseKey = getLocalLicenseKey();

  const ref = doc(db, COMPANY_COLLECTION, emailId);
  const existingSnap = await getDoc(ref).catch(() => null);
  const existing = existingSnap?.exists() ? (existingSnap.data() as CloudCompanyDetails) : undefined;

  const transferCount = (existing?.transferCount ?? 0) + (existing?.deviceId && existing.deviceId !== deviceId ? 1 : 0);

  const payload: CloudCompanyDetails = {
    ...(existing || {}),
    companyName: input.companyName,
    email: emailId,
    phone: input.phone ?? existing?.phone,
    address: input.address ?? existing?.address,
    licenseKey: licenseKey ?? existing?.licenseKey,
    activatedAt: existing?.activatedAt ?? serverTimestamp(),
    deviceId,
    lastLoginDevice: deviceId,
    lastLoginAt: serverTimestamp(),
    isTransferred: existing?.deviceId && existing.deviceId !== deviceId ? true : existing?.isTransferred ?? false,
    transferCount,
    ...(input.extra || {}),
  };

  await setDoc(ref, payload, { merge: true });
}

export async function restoreCompanyDetailsFromCloud(email: string): Promise<CloudCompanyDetails | null> {
  if (!db) return null;
  const emailId = buildCompanyDocumentId(email);
  if (!emailId) return null;

  const ref = doc(db, COMPANY_COLLECTION, emailId);
  const snap = await getDoc(ref).catch(() => null);
  if (!snap || !snap.exists()) {
    return null;
  }

  const data = snap.data() as CloudCompanyDetails;
  const deviceId = await getDeviceId().catch(() => '');

  // Update device + last login tracking
  const nextTransferCount = (data.transferCount ?? 0) + (data.deviceId && data.deviceId !== deviceId ? 1 : 0);

  await setDoc(
    ref,
    {
      deviceId,
      lastLoginDevice: deviceId,
      lastLoginAt: serverTimestamp(),
      isTransferred: data.deviceId && data.deviceId !== deviceId ? true : data.isTransferred ?? false,
      transferCount: nextTransferCount,
    },
    { merge: true }
  );

  return { ...data, deviceId };
}

export async function archiveCompanyDetails(oldEmail: string): Promise<void> {
  if (!db) return;
  const emailId = buildCompanyDocumentId(oldEmail);
  if (!emailId) return;

  const ref = doc(db, COMPANY_COLLECTION, emailId);
  const snap = await getDoc(ref).catch(() => null);
  if (!snap || !snap.exists()) return;

  const data = snap.data() as CloudCompanyDetails;

  await addDoc(collection(db, ARCHIVE_COLLECTION), {
    ...data,
    archivedFromEmail: emailId,
    deletedAt: serverTimestamp(),
  });

  await deleteDoc(ref);
}

