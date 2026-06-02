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
      if (!key || GLOBAL_KEYS.has(key)) continue;
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
    if (key && !GLOBAL_KEYS.has(key)) keysToClear.push(key);
  }
  keysToClear.forEach((k) => localStorage.removeItem(k));

  if (!data || typeof data !== 'object') return;

  Object.entries(data).forEach(([k, v]) => {
    if (GLOBAL_KEYS.has(k)) return;
    try {
      localStorage.setItem(k, String(v));
    } catch {
      // ignore quota / private mode
    }
  });
}

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
  const line1 = String(profile.addressLine1 || '').trim();
  const line2 = String(profile.addressLine2 || '').trim();
  const city = String(profile.city || '').trim();
  const state = String(profile.state || '').trim();
  const pin = String(profile.pinCode || '').replace(/\D/g, '');
  const address =
    String(profile.address || '').trim() || [line1, line2].filter(Boolean).join(', ');
  const statePin =
    String(profile.statePin || '').trim() ||
    (city && state && pin ? `${city}, ${state} - ${pin}` : [city, state].filter(Boolean).join(', '));

  if (profile.name) localStorage.setItem('companyName', profile.name);
  if (profile.gstin != null) localStorage.setItem('companyGSTIN', profile.gstin);
  if (address) localStorage.setItem('companyAddress', address);
  if (statePin) localStorage.setItem('companyStatePin', statePin);
  if (profile.mobiles != null) localStorage.setItem('companyMobiles', profile.mobiles);
  if (profile.email != null) localStorage.setItem('companyEmail', profile.email);
  if (profile.website != null) localStorage.setItem('companyWebsite', profile.website);
  if (profile.fyStartYear != null) {
    localStorage.setItem('pve_company_fy_start_year', String(profile.fyStartYear));
  }
  try {
    localStorage.setItem(
      'company-info',
      JSON.stringify({
        businessName: profile.name,
        name: profile.name,
        address,
        addressLine1: line1,
        addressLine2: line2,
        city,
        state,
        pinCode: pin,
        gstin: profile.gstin,
        phone: profile.mobiles,
        email: profile.email,
        website: profile.website,
        businessType: profile.businessType,
        ownerName: profile.ownerName,
      })
    );
  } catch {
    // ignore quota
  }
  window.dispatchEvent(new Event('companyProfileUpdated'));
  window.dispatchEvent(new Event('activeCompanyChanged'));
}
