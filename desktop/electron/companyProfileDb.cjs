/**
 * SQLite source of truth for company profile + app_settings (profile_completed).
 * Uses the configured unified database (database.sqlite).
 */
const fs = require('fs');
const path = require('path');

const LOCAL_DATA_FILE = 'company_local_storage.json';
const SETTING_PROFILE_COMPLETED = 'profile_completed';
const SETTING_PROFILE_MIGRATION_COMPLETED = 'profile_migration_completed';

function isoNow() {
  return new Date().toISOString();
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS company_profile (
      id INTEGER PRIMARY KEY,
      company_code TEXT UNIQUE,
      company_name TEXT,
      business_type TEXT,
      owner_name TEXT,
      mobile TEXT,
      email TEXT,
      gstin TEXT,
      pan TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      country TEXT,
      website TEXT,
      financial_year TEXT,
      logo_path TEXT,
      signature_path TEXT,
      stamp_path TEXT,
      bank_name TEXT,
      bank_account_number TEXT,
      bank_ifsc TEXT,
      bank_branch TEXT,
      is_profile_completed INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);
}

function getAppSetting(db, key) {
  if (!db) return null;
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row?.value != null ? String(row.value) : null;
}

function setAppSetting(db, key, value) {
  if (!db) return;
  db.prepare(
    'INSERT INTO app_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

function parseCompanyInfoFromLocalData(localData) {
  const ld = localData && typeof localData === 'object' ? localData : {};
  let info = {};
  try {
    const raw = ld['company-info'];
    if (raw) info = JSON.parse(raw);
  } catch {
    info = {};
  }
  const businessName = String(
    info.businessName || info.name || ld.companyName || ''
  ).trim();
  const address = String(info.address || ld.companyAddress || '').trim();
  const phone = String(info.phone || info.mobiles || ld.companyPhone || ld.companyMobiles || '').trim();
  const email = String(info.email || ld.companyEmail || '').trim();
  const setupCompleted = ld.setupCompleted === 'true';
  const profileComplete =
    setupCompleted || Boolean(businessName && address && phone);

  return {
    company_name: businessName,
    business_type: String(info.businessType || '').trim(),
    owner_name: String(info.ownerName || info.name || '').trim(),
    mobile: phone,
    email,
    gstin: String(info.gstin || info.gstNumber || ld.companyGSTIN || '').trim(),
    pan: String(info.panNumber || info.pan || ld.companyPAN || '').trim(),
    address,
    city: String(info.city || '').trim(),
    state: String(info.state || '').trim(),
    pincode: String(info.pinCode || info.pincode || '').replace(/\D/g, ''),
    country: String(info.country || 'India').trim(),
    website: String(info.website || ld.companyWebsite || '').trim(),
    financial_year: String(info.financialYear || ld.pve_company_fy_start_year || '').trim(),
    logo_path: String(info.logo || ld.companyLogo || '').trim(),
    signature_path: String(info.signature || ld.companySignature || '').trim(),
    stamp_path: String(info.stamp || '').trim(),
    bank_name: String(info.bankName || ld.companyBankName || '').trim(),
    bank_account_number: String(info.bankAccountNumber || info.bankAccountNo || ld.companyBankAccount || '').trim(),
    bank_ifsc: String(info.bankIfsc || info.bankIFSC || ld.companyBankIFSC || '').trim(),
    bank_branch: String(info.bankBranch || ld.companyBankBranch || '').trim(),
    is_profile_completed: profileComplete ? 1 : 0,
  };
}

function rowToProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_code: row.company_code,
    company_name: row.company_name || '',
    business_type: row.business_type || '',
    owner_name: row.owner_name || '',
    mobile: row.mobile || '',
    email: row.email || '',
    gstin: row.gstin || '',
    pan: row.pan || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    pincode: row.pincode || '',
    country: row.country || 'India',
    website: row.website || '',
    financial_year: row.financial_year || '',
    logo_path: row.logo_path || '',
    signature_path: row.signature_path || '',
    stamp_path: row.stamp_path || '',
    bank_name: row.bank_name || '',
    bank_account_number: row.bank_account_number || '',
    bank_ifsc: row.bank_ifsc || '',
    bank_branch: row.bank_branch || '',
    is_profile_completed: Boolean(row.is_profile_completed),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getProfileByCode(db, companyCode) {
  if (!db || !companyCode) return null;
  const row = db
    .prepare('SELECT * FROM company_profile WHERE company_code = ? LIMIT 1')
    .get(String(companyCode));
  return rowToProfile(row);
}

function upsertProfile(db, companyCode, input) {
  if (!db || !companyCode) throw new Error('Database or company code missing');
  const now = isoNow();
  const existing = getProfileByCode(db, companyCode);
  const payload = {
    company_code: String(companyCode),
    company_name: String(input.company_name || input.businessName || '').trim(),
    business_type: String(input.business_type || '').trim(),
    owner_name: String(input.owner_name || input.ownerName || '').trim(),
    mobile: String(input.mobile || input.phone || '').trim(),
    email: String(input.email || '').trim(),
    gstin: String(input.gstin || input.gstNumber || '').trim(),
    pan: String(input.pan || input.panNumber || '').trim(),
    address: String(input.address || '').trim(),
    city: String(input.city || '').trim(),
    state: String(input.state || '').trim(),
    pincode: String(input.pincode || input.pinCode || '').replace(/\D/g, ''),
    country: String(input.country || 'India').trim(),
    website: String(input.website || '').trim(),
    financial_year: String(input.financial_year || input.financialYear || '').trim(),
    logo_path: String(input.logo_path || input.logo || '').trim(),
    signature_path: String(input.signature_path || input.signature || '').trim(),
    stamp_path: String(input.stamp_path || input.stamp || '').trim(),
    bank_name: String(input.bank_name || input.bankName || '').trim(),
    bank_account_number: String(input.bank_account_number || input.bankAccountNumber || '').trim(),
    bank_ifsc: String(input.bank_ifsc || input.bankIfsc || '').trim(),
    bank_branch: String(input.bank_branch || input.bankBranch || '').trim(),
    is_profile_completed: input.is_profile_completed ? 1 : existing?.is_profile_completed ? 1 : 0,
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  if (input.markCompleted === true || input.is_profile_completed === true) {
    payload.is_profile_completed = 1;
  }

  if (existing) {
    db.prepare(`
      UPDATE company_profile SET
        company_name = ?, business_type = ?, owner_name = ?, mobile = ?, email = ?,
        gstin = ?, pan = ?, address = ?, city = ?, state = ?, pincode = ?, country = ?,
        website = ?, financial_year = ?, logo_path = ?, signature_path = ?, stamp_path = ?,
        bank_name = ?, bank_account_number = ?, bank_ifsc = ?, bank_branch = ?,
        is_profile_completed = ?, updated_at = ?
      WHERE company_code = ?
    `).run(
      payload.company_name,
      payload.business_type,
      payload.owner_name,
      payload.mobile,
      payload.email,
      payload.gstin,
      payload.pan,
      payload.address,
      payload.city,
      payload.state,
      payload.pincode,
      payload.country,
      payload.website,
      payload.financial_year,
      payload.logo_path,
      payload.signature_path,
      payload.stamp_path,
      payload.bank_name,
      payload.bank_account_number,
      payload.bank_ifsc,
      payload.bank_branch,
      payload.is_profile_completed,
      payload.updated_at,
      payload.company_code
    );
  } else {
    db.prepare(`
      INSERT INTO company_profile (
        company_code, company_name, business_type, owner_name, mobile, email,
        gstin, pan, address, city, state, pincode, country, website, financial_year,
        logo_path, signature_path, stamp_path, bank_name, bank_account_number, bank_ifsc, bank_branch,
        is_profile_completed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.company_code,
      payload.company_name,
      payload.business_type,
      payload.owner_name,
      payload.mobile,
      payload.email,
      payload.gstin,
      payload.pan,
      payload.address,
      payload.city,
      payload.state,
      payload.pincode,
      payload.country,
      payload.website,
      payload.financial_year,
      payload.logo_path,
      payload.signature_path,
      payload.stamp_path,
      payload.bank_name,
      payload.bank_account_number,
      payload.bank_ifsc,
      payload.bank_branch,
      payload.is_profile_completed,
      payload.created_at,
      payload.updated_at
    );
  }

  return getProfileByCode(db, companyCode);
}

function migrateFromLocalJsonIfNeeded(app, db, companyRegistry, dataPathManager) {
  if (!db) return { migrated: false, reason: 'no_db' };

  const migrationDone = getAppSetting(db, SETTING_PROFILE_MIGRATION_COMPLETED) === 'true';
  const activeId = companyRegistry.readActiveId(app);
  if (!activeId) return { migrated: false, reason: 'no_active_company' };

  const existing = getProfileByCode(db, activeId);
  if (migrationDone && existing) {
    return { migrated: false, reason: 'already_migrated', profile: existing };
  }

  const localDataPath = path.join(companyRegistry.getCompanyDir(app, activeId), LOCAL_DATA_FILE);
  let localData = {};
  if (fs.existsSync(localDataPath)) {
    try {
      localData = JSON.parse(fs.readFileSync(localDataPath, 'utf8'));
    } catch {
      localData = {};
    }
  }

  if (!existing && (!localData || Object.keys(localData).length === 0)) {
    return { migrated: false, reason: 'no_legacy_data', companyCode: activeId };
  }

  const parsed = parseCompanyInfoFromLocalData(localData);
  const profile = upsertProfile(db, activeId, { ...parsed, markCompleted: parsed.is_profile_completed === 1 });

  if (profile?.is_profile_completed) {
    setAppSetting(db, SETTING_PROFILE_COMPLETED, 'true');
  }
  setAppSetting(db, SETTING_PROFILE_MIGRATION_COMPLETED, 'true');

  const dbPath = dataPathManager ? dataPathManager.getDatabasePath(app) : '';
  const log = {
    migrated: true,
    companyCode: activeId,
    companyName: profile?.company_name || '',
    profileCompleted: Boolean(profile?.is_profile_completed),
    migrationStatus: 'completed',
    databasePath: dbPath,
    sourcePath: localDataPath,
  };
  console.log('[company-profile-db] migration', log);
  return log;
}

function evaluateProfileCompletion(db, companyCode) {
  if (!db) {
    return {
      profileCompleted: false,
      companyExists: false,
      companyCode: companyCode || '',
      companyName: '',
      reason: 'no_database',
      databasePath: '',
      migrationStatus: 'pending',
    };
  }

  const profile = companyCode ? getProfileByCode(db, companyCode) : null;
  const appFlag = getAppSetting(db, SETTING_PROFILE_COMPLETED) === 'true';
  const rowComplete = Boolean(profile?.is_profile_completed);
  const companyExists = Boolean(profile && profile.company_name);

  let profileCompleted = appFlag && rowComplete && companyExists;
  let reason = 'ok';

  if (appFlag && (!profile || !rowComplete || !companyExists)) {
    setAppSetting(db, SETTING_PROFILE_COMPLETED, 'false');
    if (profile) {
      db.prepare('UPDATE company_profile SET is_profile_completed = 0 WHERE company_code = ?').run(
        companyCode
      );
    }
    profileCompleted = false;
    reason = 'self_heal_flag_without_company_record';
  } else if (!appFlag && rowComplete && companyExists) {
    setAppSetting(db, SETTING_PROFILE_COMPLETED, 'true');
    profileCompleted = true;
    reason = 'synced_from_row';
  } else if (!profileCompleted) {
    reason = !profile ? 'no_company_profile_row' : !rowComplete ? 'profile_incomplete' : 'app_flag_false';
  }

  const migrationStatus =
    getAppSetting(db, SETTING_PROFILE_MIGRATION_COMPLETED) === 'true' ? 'completed' : 'pending';

  return {
    profileCompleted,
    companyExists,
    companyCode: companyCode || profile?.company_code || '',
    companyName: profile?.company_name || '',
    reason,
    migrationStatus,
    appFlag,
    rowComplete,
    profile,
  };
}

function getStartupDiagnostics(app, db, companyRegistry, dataPathManager, companyCode) {
  const dbPath = dataPathManager ? dataPathManager.getDatabasePath(app) : '';
  let dbSize = 0;
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch {
      dbSize = 0;
    }
  }
  const evalResult = evaluateProfileCompletion(db, companyCode);
  const payload = {
    DATABASE_PATH: dbPath,
    COMPANY_EXISTS: evalResult.companyExists,
    COMPANY_NAME: evalResult.companyName,
    COMPANY_CODE: evalResult.companyCode,
    PROFILE_COMPLETED: evalResult.profileCompleted,
    MIGRATION_STATUS: evalResult.migrationStatus,
    REASON: evalResult.reason,
    databaseSizeBytes: dbSize,
  };
  console.log('[company-profile-db] startup', payload);
  return { ...evalResult, ...payload, databasePath: dbPath };
}

function markProfileCompleted(db, companyCode, companyName) {
  if (!db || !companyCode) return { success: false };
  const profile = getProfileByCode(db, companyCode);
  if (profile) {
    db.prepare(
      'UPDATE company_profile SET is_profile_completed = 1, company_name = COALESCE(?, company_name), updated_at = ? WHERE company_code = ?'
    ).run(companyName || profile.company_name, isoNow(), companyCode);
  }
  setAppSetting(db, SETTING_PROFILE_COMPLETED, 'true');
  return { success: true, profile: getProfileByCode(db, companyCode) };
}

module.exports = {
  SETTING_PROFILE_COMPLETED,
  SETTING_PROFILE_MIGRATION_COMPLETED,
  ensureSchema,
  getAppSetting,
  setAppSetting,
  getProfileByCode,
  upsertProfile,
  migrateFromLocalJsonIfNeeded,
  evaluateProfileCompletion,
  getStartupDiagnostics,
  markProfileCompleted,
  parseCompanyInfoFromLocalData,
  rowToProfile,
};
