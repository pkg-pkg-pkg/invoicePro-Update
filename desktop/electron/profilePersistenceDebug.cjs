/**
 * Customer-side diagnostics for Business Profile persistence / onboarding loop.
 * Logs to %userData%/profile_debug.log
 */
const fs = require('fs');
const path = require('path');

const LOG_FILE = 'profile_debug.log';
const LOCAL_DATA_FILE = 'company_local_storage.json';
const PROFILE_FILE = 'company_profile.json';
const DB_FILE = 'gst-billing.db';
const LEGACY_DB_FILE = 'gst-billing.db';
const SESSION_DB_FILE = 'local_users.db';

function getLogPath(app) {
  return path.join(app.getPath('userData'), LOG_FILE);
}

function appendLog(app, event, payload) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...(payload && typeof payload === 'object' ? payload : { message: String(payload) }),
    });
    fs.appendFileSync(getLogPath(app), `${line}\n`, 'utf8');
  } catch (err) {
    console.error('[profile-debug] log write failed', err);
  }
}

function fileMeta(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { path: filePath, exists: false, sizeBytes: 0 };
    }
    const stat = fs.statSync(filePath);
    return {
      path: filePath,
      exists: true,
      sizeBytes: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  } catch (err) {
    return { path: filePath, exists: false, error: err?.message || String(err) };
  }
}

function analyzeLocalData(localData) {
  const ld = localData && typeof localData === 'object' ? localData : {};
  const setupCompleted = ld.setupCompleted === 'true';
  let companyInfo = {};
  try {
    companyInfo = ld['company-info'] ? JSON.parse(ld['company-info']) : {};
  } catch {
    companyInfo = {};
  }
  const businessName = String(
    companyInfo.businessName || companyInfo.name || ld.companyName || ''
  ).trim();
  const address = String(companyInfo.address || ld.companyAddress || '').trim();
  const phone = String(companyInfo.phone || ld.companyPhone || '').trim();
  return {
    keyCount: Object.keys(ld).length,
    setupCompleted,
    hasCompanyInfo: Boolean(ld['company-info']),
    businessName,
    address,
    phone,
    profileComplete: setupCompleted || Boolean(businessName && address && phone),
  };
}

function findSqliteFiles(rootDir, maxDepth = 4, depth = 0, found = []) {
  if (depth > maxDepth || !fs.existsSync(rootDir)) return found;
  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const ent of entries) {
    const full = path.join(rootDir, ent.name);
    if (ent.isDirectory()) {
      findSqliteFiles(full, maxDepth, depth + 1, found);
      continue;
    }
    if (ent.isFile() && ent.name.toLowerCase().endsWith('.db')) {
      found.push(fileMeta(full));
    }
  }
  return found;
}

function scanProfilePersistence(app, companyRegistry) {
  let dataPathManager;
  try {
    dataPathManager = require('./dataPathManager.cjs');
    dataPathManager.init(app, companyRegistry);
  } catch {
    dataPathManager = null;
  }
  const userData = app.getPath('userData');
  const dataConfig = dataPathManager ? dataPathManager.getPublicConfig(app) : null;
  const companiesRoot = path.join(userData, 'companies');
  const activeId = companyRegistry.readActiveId(app);
  const activeDir = activeId ? companyRegistry.getCompanyDir(app, activeId) : '';
  const localDataPath = activeDir ? path.join(activeDir, LOCAL_DATA_FILE) : '';
  const profilePath = activeDir ? path.join(activeDir, PROFILE_FILE) : '';
  const companyDbPath = activeId ? companyRegistry.getCompanyDbPath(app, activeId) : '';
  const legacyDbPath = path.join(userData, LEGACY_DB_FILE);
  const sessionDbPath = path.join(userData, SESSION_DB_FILE);

  const diskLocalData =
    activeId && companyRegistry.readCompanyLocalData
      ? companyRegistry.readCompanyLocalData(app, activeId)
      : {};

  const sqliteFiles = findSqliteFiles(userData);
  const multipleDbWarning = sqliteFiles.length > 1;

  const report = {
    userDataPath: userData,
    usesElectronUserData: true,
    dataConfig,
    activeCompanyId: activeId || '',
    paths: {
      saveReadLocalData: localDataPath,
      saveReadProfile: profilePath,
      saveReadCompanySqlite: companyDbPath,
      legacySqlite: legacyDbPath,
      sessionSqlite: sessionDbPath,
      companiesRoot,
    },
    files: {
      localData: fileMeta(localDataPath),
      profile: fileMeta(profilePath),
      companySqlite: fileMeta(companyDbPath),
      legacySqlite: fileMeta(legacyDbPath),
      sessionSqlite: fileMeta(sessionDbPath),
    },
    localDataAnalysis: analyzeLocalData(diskLocalData),
    sqliteFilesFound: sqliteFiles,
    multipleDatabaseFiles: multipleDbWarning,
    duplicateDbRisk:
      fileMeta(legacyDbPath).exists &&
      fileMeta(companyDbPath).exists &&
      legacyDbPath !== companyDbPath,
  };

  appendLog(app, 'scan', report);
  return report;
}

function logPersistResult(app, payload) {
  appendLog(app, 'persist', payload);
}

function logRendererEvent(app, payload) {
  appendLog(app, 'renderer', payload);
}

module.exports = {
  appendLog,
  scanProfilePersistence,
  logPersistResult,
  logRendererEvent,
  analyzeLocalData,
  getLogPath,
};
