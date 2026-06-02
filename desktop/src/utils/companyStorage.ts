/**
 * Per-company data isolation is handled by company folder snapshots + DB switch.
 * Keys are plain (no suffix) after company switch reload.
 */
export const getActiveCompanyId = (): string => {
  try {
    return String(localStorage.getItem('pve_active_company_id') ?? 'PVE1001').trim() || 'PVE1001';
  } catch {
    return 'PVE1001';
  }
};

export const companyScopedKey = (baseKey: string): string => baseKey;

export const readCompanyScopedRaw = (baseKey: string): string | null => {
  try {
    return localStorage.getItem(baseKey);
  } catch {
    return null;
  }
};
