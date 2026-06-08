import { getNormalizedCompanyProfile } from '../utils/companyProfile';
import { isElectronRuntime } from '../utils/runtime';

const COMPANY_ID_PATTERN = /^PVE\d+$/i;

/**
 * Display name for chrome header — full business name only (never company folder id).
 */
export async function resolveActiveCompanyDisplayName(): Promise<string> {
  const profile = getNormalizedCompanyProfile();
  let name = String(profile.businessName || profile.name || '').trim();

  if (isElectronRuntime() && window.electronAPI?.companiesGetActive) {
    try {
      const active = (await window.electronAPI.companiesGetActive()) as {
        company?: { name?: string };
        profile?: { name?: string; businessName?: string };
      };
      const fromRecord = String(active?.company?.name || '').trim();
      const fromProfile = String(
        active?.profile?.name || active?.profile?.businessName || ''
      ).trim();
      if (fromProfile && !COMPANY_ID_PATTERN.test(fromProfile)) {
        name = fromProfile;
      } else if (fromRecord && !COMPANY_ID_PATTERN.test(fromRecord)) {
        name = fromRecord;
      }
    } catch (e) {
      console.warn('[companyDisplayName] companiesGetActive failed', e);
    }
  }

  return name;
}

export function resolveActiveCompanyDisplayNameSync(): string {
  const profile = getNormalizedCompanyProfile();
  return String(profile.businessName || profile.name || '').trim();
}
