import { isElectronRuntime } from '../utils/runtime';
import { exportCompanyLocalStorage } from '../utils/companyLocalStorage';

export const COMPANY_SETTINGS_CACHE_KEY = 'pve_company_settings';
export const COMPANY_SETTINGS_CHANGED_EVENT = 'companySettingsChanged';

export type CompanySettings = {
  [key: string]: unknown;
};

export type SaveSettingsResult = {
  success: boolean;
  settings: CompanySettings;
  error?: string;
};

const DEFAULT_SETTINGS: CompanySettings = {};

const readCache = (): CompanySettings => {
  try {
    const raw = localStorage.getItem(COMPANY_SETTINGS_CACHE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

const writeCache = (settings: CompanySettings) => {
  localStorage.setItem(COMPANY_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(COMPANY_SETTINGS_CHANGED_EVENT));
};

async function persistLocalStorageSnapshot(): Promise<void> {
  if (!isElectronRuntime() || !window.electronAPI?.companyLocalDataPersist) return;
  try {
    const res = await window.electronAPI.companyLocalDataPersist(exportCompanyLocalStorage());
    if (!res?.success) {
      console.warn('[company-settings] local data persist failed', res?.error);
    }
  } catch (e) {
    console.warn('[company-settings] local data persist error', e);
  }
}

export async function loadCompanySettingsFromDisk(): Promise<CompanySettings> {
  if (isElectronRuntime() && window.electronAPI?.companySettingsRead) {
    try {
      const res = await window.electronAPI.companySettingsRead();
      if (res && 'success' in res && res.success === false) {
        console.error('[company-settings] read failed:', res.error);
      } else {
        const remote = (res && 'settings' in res ? res.settings : res) as CompanySettings | undefined;
        const merged = { ...DEFAULT_SETTINGS, ...(remote && typeof remote === 'object' ? remote : {}) };
        writeCache(merged);
        return merged;
      }
    } catch (e) {
      console.error('[company-settings] read error', e);
    }
  }
  return readCache();
}

export async function saveCompanySettings(partial: Partial<CompanySettings>): Promise<SaveSettingsResult> {
  const next: CompanySettings = { ...readCache(), ...partial };

  if (isElectronRuntime() && window.electronAPI?.companySettingsWrite) {
    try {
      const res = await window.electronAPI.companySettingsWrite(partial);

      if (!res?.success) {
        const error = res?.error || 'Could not save settings to disk';
        console.error('[company-settings] write failed:', error);
        return { success: false, settings: readCache(), error };
      }

      const saved = (res.settings ?? next) as CompanySettings;
      const merged = { ...DEFAULT_SETTINGS, ...saved };
      writeCache(merged);
      await persistLocalStorageSnapshot();
      return { success: true, settings: merged };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[company-settings] write error', e);
      return { success: false, settings: readCache(), error };
    }
  }

  writeCache(next);
  return { success: true, settings: next };
}
