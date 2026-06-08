/** Profile keys — stored in SQLite only; never exported to company_local_storage.json. */
export const PROFILE_LOCAL_STORAGE_KEYS = new Set([
  'setupCompleted',
  'setupCompletedDate',
  'company-info',
  'companyName',
  'companyAddress',
  'companyCity',
  'companyStatePin',
  'companyPhone',
  'companyMobiles',
  'companyEmail',
  'companyWebsite',
  'companyGSTIN',
  'companyPAN',
  'companyLogo',
  'companySignature',
  'companyBankName',
  'companyBankAccount',
  'companyBankIFSC',
  'companyBankBranch',
  'companyUpiId',
]);

/** Keys that stay global across company switches (auth, registry bootstrap). */
const GLOBAL_KEYS = new Set([
  'token',
  'user',
  'currentUser',
  'gst_billing_users',
  'pve_companies_bootstrapped',
  'pve_active_company_id',
]);

export function exportCompanyLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || GLOBAL_KEYS.has(key) || PROFILE_LOCAL_STORAGE_KEYS.has(key)) continue;
      const val = localStorage.getItem(key);
      if (val != null) out[key] = val;
    }
  } catch {
    // ignore
  }
  return out;
}

export function importCompanyLocalStorage(data: Record<string, string> | null | undefined) {
  const keysToClear: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !GLOBAL_KEYS.has(key) && !PROFILE_LOCAL_STORAGE_KEYS.has(key)) keysToClear.push(key);
  }
  keysToClear.forEach((k) => localStorage.removeItem(k));

  if (!data || typeof data !== 'object') return;

  Object.entries(data).forEach(([k, v]) => {
    if (GLOBAL_KEYS.has(k) || PROFILE_LOCAL_STORAGE_KEYS.has(k)) return;
    try {
      localStorage.setItem(k, String(v));
    } catch {
      // ignore quota / private mode
    }
  });
}

/** @deprecated Profile is stored in SQLite. Updates DB for legacy callers. */
export function applyCompanyProfileToLocalStorage(profile: {
  name?: string;
  gstin?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  statePin?: string;
  mobiles?: string;
  email?: string;
  website?: string;
  ownerName?: string;
  businessType?: string;
  fyStartYear?: number;
} | null) {
  if (!profile) return;
  void import('../services/companyProfileDbService').then(({ upsertCompanyProfile, invalidateCompanyProfileCache }) => {
    void upsertCompanyProfile({
      company_name: profile.name,
      gstin: profile.gstin,
      address: profile.address || profile.addressLine1,
      city: profile.city,
      state: profile.state,
      pincode: profile.pinCode,
      mobile: profile.mobiles,
      email: profile.email,
      website: profile.website,
      owner_name: profile.ownerName,
      business_type: profile.businessType,
    }).then(() => {
      invalidateCompanyProfileCache();
      window.dispatchEvent(new Event('companyProfileUpdated'));
      window.dispatchEvent(new Event('activeCompanyChanged'));
    });
  });
}
