/**
 * Multi-company registry: companies_index.json + per-company folders (PVE1001, PVE1002, …).
 */
const fs = require('fs');
const path = require('path');

const INDEX_FILE = 'companies_index.json';
const ACTIVE_FILE = 'active_company.json';
const LOCAL_DATA_FILE = 'company_local_storage.json';
const PROFILE_FILE = 'company_profile.json';
const SETTINGS_FILE = 'settings.json';
const DEFAULT_COMPANY_SETTINGS = { invoice_template: 'navy-gold' };
const DB_FILE = 'gst-billing.db';
const BACKUPS_DIR = 'backups';

function getAppDataRoot(app) {
  return app.getPath('userData');
}

function getCompaniesRoot(app) {
  return path.join(getAppDataRoot(app), 'companies');
}

function getIndexPath(app) {
  return path.join(getAppDataRoot(app), INDEX_FILE);
}

function getActivePath(app) {
  return path.join(getAppDataRoot(app), ACTIVE_FILE);
}

function getLegacyDbPath(app) {
  return path.join(getAppDataRoot(app), DB_FILE);
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.copyFileSync(tmp, filePath);
      fs.unlinkSync(tmp);
    } catch {
      throw err;
    }
  }
}

function formatFyLabel(fyStartYear) {
  const y = Number(fyStartYear);
  if (!Number.isFinite(y)) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const start = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    const end = start + 1;
    return `${String(start).slice(-2)}-${String(end).slice(-2)}`;
  }
  const end = y + 1;
  return `${String(y).slice(-2)}-${String(end).slice(-2)}`;
}

function readIndex(app) {
  const index = readJsonFile(getIndexPath(app), { companies: [], last_id_counter: 0 });
  if (!index.default_company && index.companies?.length) {
    const def = index.companies.find((c) => c.is_default && !c.deleted);
    index.default_company = def?.id || index.companies[0]?.id || '';
  }
  return index;
}

function writeIndex(app, index) {
  writeJsonFileAtomic(getIndexPath(app), index);
}

function readActiveId(app) {
  const active = readJsonFile(getActivePath(app), null);
  const id = String(active?.id ?? '').trim();
  if (id) return id;
  const index = readIndex(app);
  return String(index.companies?.[0]?.id ?? '');
}

function writeActiveId(app, id) {
  writeJsonFileAtomic(getActivePath(app), { id: String(id) });
}

function getCompanyDir(app, companyId) {
  return path.join(getCompaniesRoot(app), String(companyId));
}

function ensureCompanyDirs(app, companyId) {
  const root = getCompanyDir(app, companyId);
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, BACKUPS_DIR), { recursive: true });
  return root;
}

function nextCompanyId(index) {
  const next = Number(index.last_id_counter || 0) + 1;
  index.last_id_counter = next;
  return `PVE${1000 + next}`;
}

function copyFileSafe(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    if (err && err.code === 'EBUSY') {
      const buf = fs.readFileSync(src);
      fs.writeFileSync(dest, buf);
      return;
    }
    throw err;
  }
}

function buildDefaultProfile(name, gstin, ownerName, fyStartYear, extra) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const fyStart = Number.isFinite(Number(fyStartYear))
    ? Number(fyStartYear)
    : month >= 4
      ? year
      : year - 1;
  const e = extra && typeof extra === 'object' ? extra : {};
  return {
    name: String(e.name || name || 'New Company').trim(),
    gstin: String(e.gstin ?? gstin ?? '').trim(),
    ownerName: String(e.ownerName ?? ownerName ?? '').trim(),
    businessType: String(e.businessType || '').trim(),
    fyStartYear: fyStart,
    addressLine1: String(e.addressLine1 || '').trim(),
    addressLine2: String(e.addressLine2 || '').trim(),
    city: String(e.city || '').trim(),
    district: String(e.district || '').trim(),
    state: String(e.state || '').trim(),
    pinCode: String(e.pinCode || '').trim(),
    address: String(e.address || '').trim(),
    statePin: String(e.statePin || '').trim(),
    mobiles: String(e.mobiles ?? e.mobile ?? '').trim(),
    email: String(e.email || '').trim(),
    website: String(e.website || '').trim(),
    updatedAt: now.toISOString(),
  };
}

function buildProfileFromInput(input) {
  const line1 = String(input?.addressLine1 || '').trim();
  const line2 = String(input?.addressLine2 || '').trim();
  const city = String(input?.city || '').trim();
  const district = String(input?.district || '').trim();
  const state = String(input?.state || '').trim();
  const pin = String(input?.pinCode || '').replace(/\D/g, '');
  const address =
    String(input?.address || '').trim() || [line1, line2].filter(Boolean).join(', ');
  const loc = [city, district, state].filter(Boolean).join(', ');
  const statePin =
    String(input?.statePin || '').trim() ||
    (loc && pin ? `${loc} - ${pin}` : loc);

  return buildDefaultProfile(input?.name, input?.gstin, input?.ownerName, input?.fyStartYear, {
    ...input,
    address,
    statePin,
    addressLine1: line1,
    addressLine2: line2,
    city,
    district,
    state,
    pinCode: pin,
    mobiles: String(input?.mobiles ?? input?.mobile ?? '').replace(/\D/g, ''),
  });
}

function buildLocalDataSeedFromProfile(profile) {
  return {
    companyName: profile.name,
    companyGSTIN: profile.gstin,
    companyAddress: profile.address,
    companyStatePin: profile.statePin,
    companyMobiles: profile.mobiles,
    companyEmail: profile.email,
    companyWebsite: profile.website,
    'company-info': JSON.stringify({
      businessName: profile.name,
      name: profile.name,
      address: profile.address,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      district: profile.district,
      state: profile.state,
      pinCode: profile.pinCode,
      gstin: profile.gstin,
      phone: profile.mobiles,
      email: profile.email,
      website: profile.website,
      businessType: profile.businessType,
      ownerName: profile.ownerName,
    }),
    setupCompleted: 'true',
  };
}

function readCompanyProfile(app, companyId) {
  const p = path.join(getCompanyDir(app, companyId), PROFILE_FILE);
  return readJsonFile(p, null);
}

function writeCompanyProfile(app, companyId, profile) {
  const p = path.join(ensureCompanyDirs(app, companyId), PROFILE_FILE);
  writeJsonFileAtomic(p, profile);
}

function readCompanySettings(app, companyId) {
  const p = path.join(getCompanyDir(app, companyId), SETTINGS_FILE);
  const raw = readJsonFile(p, {});
  return { ...DEFAULT_COMPANY_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
}

function writeCompanySettings(app, companyId, partial) {
  const id = String(companyId || '').trim();
  if (!id) throw new Error('Company id required');
  ensureCompanyDirs(app, id);
  const current = readCompanySettings(app, id);
  const patch = partial && typeof partial === 'object' ? partial : {};
  const next = { ...current, ...patch };
  if (patch.invoice_template != null) {
    next.invoice_template = String(patch.invoice_template);
  }
  const p = path.join(getCompanyDir(app, id), SETTINGS_FILE);
  try {
    writeJsonFileAtomic(p, next);
    const localData = readCompanyLocalData(app, id);
    localData.pve_company_settings = JSON.stringify(next);
    writeCompanyLocalData(app, id, localData);
    return { success: true, settings: next, path: p };
  } catch (err) {
    console.error('[company-settings] write failed', { id, path: p, err });
    return { success: false, error: err && err.message ? err.message : String(err), settings: current };
  }
}

function profileFromLocalData(localData) {
  const ld = localData && typeof localData === 'object' ? localData : {};
  let info = {};
  try {
    const raw = ld['company-info'];
    if (raw) info = JSON.parse(raw);
  } catch {
    info = {};
  }

  const name = String(info.businessName || info.name || ld.companyName || '').trim();
  const gstin = String(info.gstin || ld.companyGSTIN || '').trim();
  const address = String(info.address || ld.companyAddress || '').trim();
  const statePin = String(info.statePin || ld.companyStatePin || '').trim();
  const mobiles = String(info.phone || info.mobiles || ld.companyMobiles || '').trim();
  const email = String(info.email || ld.companyEmail || '').trim();
  const website = String(info.website || ld.companyWebsite || '').trim();
  let city = String(info.city || '').trim();
  let district = String(info.district || '').trim();
  let state = String(info.state || '').trim();

  if ((!city || !state) && statePin) {
    const parts = statePin.split(',').map((s) => s.trim()).filter(Boolean);
    if (!city && parts[0]) city = parts[0];
    if (!state && parts[1]) {
      state = parts[1].replace(/\s*-?\s*\d{6}$/, '').trim();
    }
  }

  return {
    name,
    gstin,
    address,
    statePin,
    mobiles,
    email,
    website,
    city,
    district,
    state,
    pinCode: String(info.pinCode || '').replace(/\D/g, ''),
  };
}

function syncProfileFromLocalData(app, companyId, localData) {
  const id = String(companyId || '').trim();
  if (!id) return;
  const parsed = profileFromLocalData(localData);
  if (!parsed.name && !parsed.gstin && !parsed.address) return;

  const existing = readCompanyProfile(app, id) || {};
  const profile = {
    ...existing,
    ...parsed,
    name: parsed.name || existing.name,
    gstin: parsed.gstin || existing.gstin,
    address: parsed.address || existing.address,
    statePin: parsed.statePin || existing.statePin,
    mobiles: parsed.mobiles || existing.mobiles,
    email: parsed.email || existing.email,
    website: parsed.website || existing.website,
    city: parsed.city || existing.city,
    district: parsed.district || existing.district,
    state: parsed.state || existing.state,
    updatedAt: new Date().toISOString(),
  };
  writeCompanyProfile(app, id, profile);

  const index = readIndex(app);
  index.companies = (index.companies || []).map((c) => {
    if (c.id !== id || c.deleted) return c;
    return {
      ...c,
      name: profile.name || c.name,
      gstin: profile.gstin || c.gstin,
      city: profile.city || c.city,
    };
  });
  writeIndex(app, index);
}

function persistCompanyLocalData(app, companyId, localData) {
  const id = String(companyId || '').trim();
  if (!id) throw new Error('Company id required');
  ensureCompanyDirs(app, id);
  const payload = localData && typeof localData === 'object' ? localData : {};
  writeCompanyLocalData(app, id, payload);
  syncProfileFromLocalData(app, id, payload);
  return { success: true };
}

function ensureCompanySettingsFile(app, companyId) {
  const p = path.join(getCompanyDir(app, companyId), SETTINGS_FILE);
  if (!fs.existsSync(p)) {
    writeJsonFileAtomic(p, { ...DEFAULT_COMPANY_SETTINGS });
  }
}

function readCompanyLocalData(app, companyId) {
  const p = path.join(getCompanyDir(app, companyId), LOCAL_DATA_FILE);
  return readJsonFile(p, {});
}

function writeCompanyLocalData(app, companyId, localData) {
  const p = path.join(ensureCompanyDirs(app, companyId), LOCAL_DATA_FILE);
  writeJsonFileAtomic(p, localData && typeof localData === 'object' ? localData : {});
}

function getCompanyDbPath(app, companyId) {
  return path.join(ensureCompanyDirs(app, companyId), DB_FILE);
}

function ensureInitialized(app, localDataFromRenderer) {
  const indexPath = getIndexPath(app);
  const companiesRoot = getCompaniesRoot(app);
  fs.mkdirSync(companiesRoot, { recursive: true });

  let index = readIndex(app);
  if (!index.companies || index.companies.length === 0) {
    const id = nextCompanyId(index);
    const legacyName =
      (localDataFromRenderer && localDataFromRenderer.companyName) ||
      (localDataFromRenderer && localDataFromRenderer['companyName']) ||
      'PVE';
    const record = {
      id,
      name: String(legacyName).trim() || 'PVE',
      gstin: String(localDataFromRenderer?.companyGSTIN ?? localDataFromRenderer?.['companyGSTIN'] ?? '').trim(),
      ownerName: '',
      fyStartYear: new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1,
      created: new Date().toISOString().slice(0, 10),
      is_default: true,
    };
    index.companies = [record];
    index.default_company = id;
    writeIndex(app, index);
    writeActiveId(app, id);
    ensureCompanyDirs(app, id);

    const legacyDb = getLegacyDbPath(app);
    const companyDb = getCompanyDbPath(app, id);
    if (fs.existsSync(legacyDb) && !fs.existsSync(companyDb)) {
      copyFileSafe(legacyDb, companyDb);
    }

    const profile = buildDefaultProfile(record.name, record.gstin, record.ownerName, record.fyStartYear);
    if (localDataFromRenderer && typeof localDataFromRenderer === 'object') {
      profile.name = String(localDataFromRenderer.companyName || profile.name).trim();
      profile.gstin = String(localDataFromRenderer.companyGSTIN || profile.gstin).trim();
      profile.address = String(localDataFromRenderer.companyAddress || '').trim();
      profile.statePin = String(localDataFromRenderer.companyStatePin || '').trim();
      profile.mobiles = String(localDataFromRenderer.companyMobiles || '').trim();
      profile.email = String(localDataFromRenderer.companyEmail || '').trim();
      profile.website = String(localDataFromRenderer.companyWebsite || '').trim();
      writeCompanyLocalData(app, id, localDataFromRenderer);
    }
    writeCompanyProfile(app, id, profile);
    ensureCompanySettingsFile(app, id);
    return { migrated: true, activeId: id, company: record };
  }

  const activeId = readActiveId(app);
  if (activeId) {
    ensureCompanyDirs(app, activeId);
    ensureCompanySettingsFile(app, activeId);
    if (localDataFromRenderer && typeof localDataFromRenderer === 'object') {
      const existing = readCompanyLocalData(app, activeId);
      if (!existing || Object.keys(existing).length === 0) {
        writeCompanyLocalData(app, activeId, localDataFromRenderer);
      }
    }
  }
  return { migrated: false, activeId, companies: index.companies };
}

function listCompanies(app) {
  ensureInitialized(app, null);
  const index = readIndex(app);
  const activeId = readActiveId(app);
  const defaultId = String(index.default_company || '').trim();
  return {
    companies: (index.companies || []).filter((c) => !c.deleted),
    activeId,
    defaultCompany: defaultId,
  };
}

function enrichCompany(app, record, defaultId) {
  const profile = readCompanyProfile(app, record.id);
  const localData = readCompanyLocalData(app, record.id);
  const fromLocal = profileFromLocalData(localData);
  const gstin = String(profile?.gstin || fromLocal.gstin || record.gstin || '').trim();
  const fyStartYear = profile?.fyStartYear ?? record.fyStartYear;
  const city = String(profile?.city || fromLocal.city || record.city || '').trim();
  const district = String(profile?.district || fromLocal.district || '').trim();
  const state = String(profile?.state || fromLocal.state || '').trim();
  const name = String(profile?.name || fromLocal.name || record.name || '').trim();
  const dbPath = getCompanyDbPath(app, record.id);
  return {
    ...record,
    name,
    gstin,
    city,
    district,
    state,
    fy: formatFyLabel(fyStartYear),
    fyStartYear,
    is_default: record.id === defaultId || Boolean(record.is_default),
    data_folder: getCompanyDir(app, record.id),
    folderOk: fs.existsSync(dbPath),
  };
}

function listCompaniesEnriched(app) {
  const base = listCompanies(app);
  const defaultId = base.defaultCompany || '';
  (base.companies || []).forEach((c) => {
    const localData = readCompanyLocalData(app, c.id);
    syncProfileFromLocalData(app, c.id, localData);
  });
  return {
    ...base,
    companies: base.companies.map((c) => enrichCompany(app, c, defaultId)),
  };
}

function setDefaultCompany(app, companyId) {
  const id = String(companyId || '').trim();
  const index = readIndex(app);
  const company = (index.companies || []).find((c) => c.id === id && !c.deleted);
  if (!company) throw new Error('Company not found');
  index.default_company = id;
  index.companies = (index.companies || []).map((c) => ({
    ...c,
    is_default: c.id === id,
  }));
  writeIndex(app, index);
  return { defaultCompany: id };
}

function getActiveCompany(app) {
  const { companies, activeId } = listCompanies(app);
  const company = companies.find((c) => c.id === activeId) || companies[0];
  if (!company) throw new Error('No active company');
  return {
    company,
    profile: readCompanyProfile(app, company.id),
    localData: readCompanyLocalData(app, company.id),
    dbPath: getCompanyDbPath(app, company.id),
  };
}

function createCompany(app, input, currentLocalData) {
  const index = readIndex(app);
  const activeId = readActiveId(app);

  if (activeId && currentLocalData) {
    writeCompanyLocalData(app, activeId, currentLocalData);
  }

  const id = nextCompanyId(index);
  const profile = buildProfileFromInput(input);
  const record = {
    id,
    name: profile.name,
    gstin: profile.gstin,
    ownerName: profile.ownerName,
    city: profile.city,
    fyStartYear: profile.fyStartYear,
    created: new Date().toISOString().slice(0, 10),
  };
  if (!record.name) throw new Error('Company name is required');

  index.companies = [...(index.companies || []), record];
  writeIndex(app, index);

  ensureCompanyDirs(app, id);
  writeCompanyProfile(app, id, profile);
  writeCompanyLocalData(app, id, buildLocalDataSeedFromProfile(profile));
  ensureCompanySettingsFile(app, id);

  writeActiveId(app, id);
  return { company: record, activeId: id };
}

function switchCompany(app, targetId, currentLocalData) {
  const id = String(targetId || '').trim();
  const index = readIndex(app);
  const company = (index.companies || []).find((c) => c.id === id && !c.deleted);
  if (!company) throw new Error('Company not found');

  const prevId = readActiveId(app);
  if (prevId && currentLocalData) {
    writeCompanyLocalData(app, prevId, currentLocalData);
  }

  writeActiveId(app, id);
  ensureCompanyDirs(app, id);

  return {
    company,
    activeId: id,
    profile: readCompanyProfile(app, id),
    localData: readCompanyLocalData(app, id),
    dbPath: getCompanyDbPath(app, id),
  };
}

function deleteCompany(app, companyId, currentLocalData) {
  const id = String(companyId || '').trim();
  const index = readIndex(app);
  const activeId = readActiveId(app);
  const visible = (index.companies || []).filter((c) => !c.deleted);

  const target = visible.find((c) => c.id === id);
  if (!target) throw new Error('Company not found');
  if (visible.length <= 1) {
    throw new Error('Cannot delete the only company. Create another company first.');
  }

  if (activeId === id && currentLocalData) {
    writeCompanyLocalData(app, id, currentLocalData);
  }

  index.companies = (index.companies || []).map((c) =>
    c.id === id
      ? { ...c, deleted: true, deletedAt: new Date().toISOString() }
      : c
  );

  const remaining = index.companies.filter((c) => !c.deleted);
  if (index.default_company === id) {
    const nextDefault = remaining[0];
    if (nextDefault) {
      index.default_company = nextDefault.id;
      index.companies = index.companies.map((c) => ({
        ...c,
        is_default: c.id === nextDefault.id && !c.deleted,
      }));
    }
  }

  writeIndex(app, index);

  if (activeId !== id) {
    return { deletedId: id, activeId, switched: false };
  }

  const next = remaining[0];
  if (!next) throw new Error('No company left after delete');

  writeActiveId(app, next.id);
  ensureCompanyDirs(app, next.id);

  return {
    deletedId: id,
    activeId: next.id,
    switched: true,
    company: next,
    profile: readCompanyProfile(app, next.id),
    localData: readCompanyLocalData(app, next.id),
    dbPath: getCompanyDbPath(app, next.id),
  };
}

module.exports = {
  BACKUPS_DIR,
  ensureInitialized,
  listCompanies,
  listCompaniesEnriched,
  setDefaultCompany,
  getActiveCompany,
  createCompany,
  switchCompany,
  deleteCompany,
  getCompanyDir,
  getCompanyDbPath,
  readActiveId,
  ensureCompanyDirs,
  formatFyLabel,
  readCompanySettings,
  writeCompanySettings,
  persistCompanyLocalData,
  SETTINGS_FILE,
  DEFAULT_COMPANY_SETTINGS,
};
