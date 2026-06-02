import type { ElectronAPI } from '../types/electron';
import { isElectronRuntime } from '../utils/runtime';
import {
  applyCompanyProfileToLocalStorage,
  exportCompanyLocalStorage,
  importCompanyLocalStorage,
} from '../utils/companyLocalStorage';

export type CompanyRecord = {
  id: string;
  name: string;
  gstin?: string;
  ownerName?: string;
  city?: string;
  district?: string;
  state?: string;
  fyStartYear?: number;
  created: string;
  deleted?: boolean;
  is_default?: boolean;
  fy?: string;
  data_folder?: string;
  folderOk?: boolean;
};

export type CreateCompanyInput = {
  name: string;
  gstin?: string;
  ownerName?: string;
  businessType?: string;
  fyStartYear?: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  address?: string;
  statePin?: string;
  mobiles?: string;
  mobile?: string;
  email?: string;
  website?: string;
};

export type EnrichedCompanyRecord = CompanyRecord & {
  fy: string;
  is_default: boolean;
  folderOk: boolean;
};

type ActivePayload = {
  company: CompanyRecord;
  profile: Record<string, unknown> | null;
  localData: Record<string, string>;
};

const api = (): ElectronAPI | undefined =>
  isElectronRuntime() ? window.electronAPI : undefined;

export async function ensureCompaniesInitialized(): Promise<void> {
  if (!isElectronRuntime() || !api()?.companiesEnsureInitialized) return;
  const localData = exportCompanyLocalStorage();
  const res = (await api()!.companiesEnsureInitialized!(localData)) as {
    activeId?: string;
    migrated?: boolean;
  };
  if (res?.activeId) localStorage.setItem('pve_active_company_id', res.activeId);
  localStorage.setItem('pve_companies_bootstrapped', '1');
  const { loadCompanySettingsFromDisk } = await import('./companySettingsService');
  await loadCompanySettingsFromDisk();
}

export async function listCompanies(): Promise<{
  companies: CompanyRecord[];
  activeId: string;
  defaultCompany?: string;
}> {
  if (!isElectronRuntime() || !api()?.companiesList) {
    return { companies: [], activeId: localStorage.getItem('pve_active_company_id') || 'PVE1001' };
  }
  return (await api()!.companiesList!()) as {
    companies: CompanyRecord[];
    activeId: string;
    defaultCompany?: string;
  };
}

export async function listCompaniesEnriched(): Promise<{
  companies: EnrichedCompanyRecord[];
  activeId: string;
  defaultCompany: string;
}> {
  if (isElectronRuntime() && api()?.companiesListEnriched) {
    await persistActiveCompanyLocalData();
    return (await api()!.companiesListEnriched!()) as {
      companies: EnrichedCompanyRecord[];
      activeId: string;
      defaultCompany: string;
    };
  }
  const base = await listCompanies();
  return {
    companies: base.companies.map((c) => ({
      ...c,
      fy: c.fy || '—',
      is_default: Boolean(c.is_default),
      folderOk: true,
    })),
    activeId: base.activeId,
    defaultCompany: base.defaultCompany || '',
  };
}

export async function setDefaultCompany(companyId: string): Promise<void> {
  if (!isElectronRuntime() || !api()?.companiesSetDefault) {
    throw new Error('Set default company is only available in the desktop app.');
  }
  await api()!.companiesSetDefault!(companyId);
}

export async function deleteCompany(companyId: string): Promise<{
  deletedId: string;
  activeId: string;
  switched: boolean;
}> {
  if (!isElectronRuntime() || !api()?.companiesDelete) {
    throw new Error('Delete company is only available in the desktop app.');
  }
  const localData = exportCompanyLocalStorage();
  const res = (await api()!.companiesDelete!({
    companyId,
    currentLocalData: localData,
  })) as ActivePayload & {
    deletedId: string;
    activeId: string;
    switched: boolean;
  };
  if (res.switched && res.company && res.localData) {
    await applyCompanySwitch(res);
  }
  return {
    deletedId: res.deletedId,
    activeId: res.activeId,
    switched: Boolean(res.switched),
  };
}

export async function getActiveCompanyPayload(): Promise<ActivePayload | null> {
  if (!isElectronRuntime() || !api()?.companiesGetActive) return null;
  return (await api()!.companiesGetActive!()) as ActivePayload;
}

export async function createCompany(input: CreateCompanyInput): Promise<ActivePayload> {
  if (!isElectronRuntime() || !api()?.companiesCreate) {
    throw new Error('Multi-company is only available in the desktop app.');
  }
  const localData = exportCompanyLocalStorage();
  const res = (await api()!.companiesCreate!({ ...input, currentLocalData: localData })) as ActivePayload & {
    activeId: string;
  };
  await applyCompanySwitch(res);
  return res;
}

export async function switchCompany(targetId: string): Promise<ActivePayload> {
  if (!isElectronRuntime() || !api()?.companiesSwitch) {
    throw new Error('Multi-company is only available in the desktop app.');
  }
  const localData = exportCompanyLocalStorage();
  const res = (await api()!.companiesSwitch!({ targetId, currentLocalData: localData })) as ActivePayload & {
    activeId: string;
  };
  await applyCompanySwitch(res);
  return res;
}

export async function applyCompanySwitch(payload: ActivePayload & { activeId?: string }) {
  if (payload.activeId) localStorage.setItem('pve_active_company_id', payload.activeId);
  importCompanyLocalStorage(payload.localData || {});
  applyCompanyProfileToLocalStorage(
    (payload.profile as Parameters<typeof applyCompanyProfileToLocalStorage>[0]) || {
      name: payload.company?.name,
    }
  );
  const { loadCompanySettingsFromDisk } = await import('./companySettingsService');
  await loadCompanySettingsFromDisk();
}

/** Reload app state after company switch (full data isolation). */
export function reloadAfterCompanySwitch() {
  window.location.reload();
}

/** Persist localStorage snapshot + sync company_profile.json and registry index. */
export async function persistActiveCompanyLocalData(): Promise<{ success: boolean; error?: string }> {
  if (!isElectronRuntime() || !api()?.companyLocalDataPersist) {
    return { success: true };
  }
  try {
    const localData = exportCompanyLocalStorage();
    const res = await api()!.companyLocalDataPersist!(localData);
    return { success: Boolean(res?.success), error: res?.error };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn('[company-registry] persist failed', error);
    return { success: false, error };
  }
}
