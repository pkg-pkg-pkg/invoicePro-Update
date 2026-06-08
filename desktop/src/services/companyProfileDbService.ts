import type { CompanyProfileCompletionStatus, CompanyProfileRow } from '@/types/electron';
import type { NormalizedCompanyProfile } from '@/utils/companyProfile';
import { isElectronRuntime } from '@/utils/runtime';

let cachedProfile: NormalizedCompanyProfile | null = null;
let cacheTs = 0;
const CACHE_MS = 5000;

function api() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

export function rowToNormalized(row: CompanyProfileRow | null | undefined): NormalizedCompanyProfile {
  if (!row) {
    return {
      name: '',
      businessName: '',
      address: '',
      gstin: '',
      phone: '',
      email: '',
      website: '',
      state: '',
      city: '',
      pinCode: '',
      logo: '',
      signature: '',
      termsAndConditions: '',
      bank: '',
      accountNo: '',
      ifsc: '',
    };
  }
  const name = String(row.company_name || '').trim();
  return {
    name,
    businessName: name,
    address: String(row.address || '').trim(),
    gstin: String(row.gstin || '').trim(),
    phone: String(row.mobile || '').trim(),
    email: String(row.email || '').trim(),
    website: String(row.website || '').trim(),
    state: String(row.state || '').trim(),
    city: String(row.city || '').trim(),
    pinCode: String(row.pincode || '').trim(),
    logo: String(row.logo_path || '').trim(),
    signature: String(row.signature_path || '').trim(),
    termsAndConditions: '',
    bank: String(row.bank_name || '').trim(),
    accountNo: String(row.bank_account_number || '').trim(),
    ifsc: String(row.bank_ifsc || '').trim(),
  };
}

export function normalizedToUpsertPayload(
  profile: Partial<NormalizedCompanyProfile> & Record<string, unknown>,
  extras?: Record<string, unknown>
): Record<string, unknown> {
  const businessName = String(profile.businessName || profile.name || profile.company_name || '').trim();
  return {
    company_name: businessName,
    business_type: profile.business_type || profile.businessType || '',
    owner_name: profile.owner_name || profile.ownerName || '',
    mobile: profile.phone || profile.mobile || '',
    email: profile.email || '',
    gstin: profile.gstin || profile.gstNumber || '',
    pan: profile.pan || profile.panNumber || '',
    address: profile.address || '',
    city: profile.city || '',
    state: profile.state || '',
    pincode: profile.pinCode || profile.pincode || '',
    country: profile.country || 'India',
    website: profile.website || '',
    financial_year: profile.financial_year || profile.financialYear || '',
    logo_path: profile.logo || profile.logo_path || '',
    signature_path: profile.signature || profile.signature_path || '',
    stamp_path: profile.stamp || profile.stamp_path || '',
    bank_name: profile.bank || profile.bank_name || profile.bankName || '',
    bank_account_number: profile.accountNo || profile.bank_account_number || profile.bankAccountNumber || '',
    bank_ifsc: profile.ifsc || profile.bank_ifsc || profile.bankIfsc || '',
    bank_branch: profile.bank_branch || profile.bankBranch || '',
    ...extras,
  };
}

export async function getActiveCompanyProfileRow(): Promise<CompanyProfileRow | null> {
  if (!isElectronRuntime()) return null;
  const res = await api()?.companyProfileGetActive?.();
  if (!res?.success) return null;
  return res.profile ?? null;
}

export async function getActiveProfileFromDb(): Promise<NormalizedCompanyProfile> {
  if (!isElectronRuntime()) {
    return rowToNormalized(null);
  }
  const now = Date.now();
  if (cachedProfile && now - cacheTs < CACHE_MS) {
    return cachedProfile;
  }
  const row = await getActiveCompanyProfileRow();
  cachedProfile = rowToNormalized(row);
  cacheTs = now;
  return cachedProfile;
}

export function getCachedCompanyProfile(): NormalizedCompanyProfile {
  return cachedProfile ?? rowToNormalized(null);
}

export function setCachedCompanyProfile(profile: NormalizedCompanyProfile): void {
  cachedProfile = profile;
  cacheTs = Date.now();
}

export function invalidateCompanyProfileCache(): void {
  cachedProfile = null;
  cacheTs = 0;
}

export async function preloadCompanyProfile(): Promise<NormalizedCompanyProfile> {
  return getActiveProfileFromDb();
}

export async function upsertCompanyProfile(
  payload: Record<string, unknown>
): Promise<{ success: boolean; profile?: CompanyProfileRow | null; error?: string }> {
  if (!isElectronRuntime()) {
    return { success: false, error: 'Not in Electron runtime' };
  }
  const res = await api()?.companyProfileUpsert?.(payload);
  invalidateCompanyProfileCache();
  return {
    success: Boolean(res?.success),
    profile: res?.profile ?? null,
    error: res?.error,
  };
}

export async function markCompanyProfileCompleted(
  companyName?: string,
  companyCode?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isElectronRuntime()) {
    return { success: false, error: 'Not in Electron runtime' };
  }
  const res = await api()?.companyProfileMarkCompleted?.({
    companyName,
    companyCode,
  });
  invalidateCompanyProfileCache();
  return { success: Boolean(res?.success), error: res?.error };
}

export async function getProfileCompletionStatus(): Promise<CompanyProfileCompletionStatus> {
  if (!isElectronRuntime()) {
    return {
      success: true,
      profileCompleted: false,
      companyExists: false,
      reason: 'not_electron',
      migrationStatus: 'pending',
    };
  }
  const res = await api()?.companyProfileCompletionStatus?.();
  return res || { success: false, profileCompleted: false, reason: 'no_response' };
}

export async function runProfileMigration(): Promise<Record<string, unknown>> {
  if (!isElectronRuntime()) return { success: false };
  const res = await api()?.companyProfileRunMigration?.();
  invalidateCompanyProfileCache();
  return res || { success: false };
}
