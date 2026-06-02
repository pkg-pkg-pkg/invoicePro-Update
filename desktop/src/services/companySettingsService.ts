import { isElectronRuntime } from '../utils/runtime';
import { exportCompanyLocalStorage } from '../utils/companyLocalStorage';
import type { InvoiceTemplateId } from '../templates/invoice/invoiceTemplatesConfig';

export const COMPANY_SETTINGS_CACHE_KEY = 'pve_company_settings';
export const COMPANY_SETTINGS_CHANGED_EVENT = 'companySettingsChanged';

export type CompanySettings = {
  invoice_template: InvoiceTemplateId;
  invoice_page_size?: string;
  invoice_orientation?: string;
  invoice_print_skip_setup?: boolean;
  [key: string]: unknown;
};

export type SaveSettingsResult = {
  success: boolean;
  settings: CompanySettings;
  error?: string;
};

const DEFAULT_SETTINGS: CompanySettings = {
  invoice_template: 'navy-gold',
  invoice_page_size: 'A4',
  invoice_orientation: 'portrait',
};

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

const normalizeTemplateId = (id: string): InvoiceTemplateId => {
  if (id === 'modern-blue' || id === 'clean-minimal' || id === 'navy-gold') return id;
  return 'navy-gold';
};

export function getInvoiceTemplateId(): InvoiceTemplateId {
  return normalizeTemplateId(String(readCache().invoice_template || 'navy-gold'));
}

export function getInvoicePrintLayout(): { pageSize: string; orientation: string } {
  const s = readCache();
  return {
    pageSize: String(s.invoice_page_size || 'A4'),
    orientation: String(s.invoice_orientation || 'portrait'),
  };
}

export function shouldSkipPrintSetupDialog(): boolean {
  const s = readCache();
  if (s.invoice_print_skip_setup === true) return true;
  try {
    return Boolean(localStorage.getItem('invoice-settings'));
  } catch {
    return false;
  }
}

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
  if (partial.invoice_template) {
    next.invoice_template = normalizeTemplateId(String(partial.invoice_template));
  }

  if (isElectronRuntime() && window.electronAPI?.companySettingsWrite) {
    try {
      const patch: Partial<CompanySettings> = {};
      if (partial.invoice_template != null) patch.invoice_template = next.invoice_template;
      if (partial.invoice_page_size != null) patch.invoice_page_size = String(partial.invoice_page_size);
      if (partial.invoice_orientation != null) patch.invoice_orientation = String(partial.invoice_orientation);
      if (partial.invoice_print_skip_setup != null) {
        patch.invoice_print_skip_setup = Boolean(partial.invoice_print_skip_setup);
      }

      const res = await window.electronAPI.companySettingsWrite(
        Object.keys(patch).length ? patch : partial
      );

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

export async function setInvoiceTemplate(templateId: InvoiceTemplateId): Promise<SaveSettingsResult> {
  return saveCompanySettings({ invoice_template: normalizeTemplateId(templateId) });
}

export async function setInvoicePrintDefaults(
  templateId: InvoiceTemplateId,
  pageSize: string,
  orientation: string
): Promise<SaveSettingsResult> {
  try {
    const raw = localStorage.getItem('invoice-settings');
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      'invoice-settings',
      JSON.stringify({
        ...prev,
        pageSize,
        orientation,
      })
    );
  } catch {
    // ignore
  }
  return saveCompanySettings({
    invoice_template: normalizeTemplateId(templateId),
    invoice_page_size: pageSize,
    invoice_orientation: orientation,
    invoice_print_skip_setup: true,
  });
}
