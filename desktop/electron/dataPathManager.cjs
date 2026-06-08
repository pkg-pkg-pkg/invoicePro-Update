/**
 * Enterprise data storage — single source of truth for all on-disk paths.
 * Bootstrap config always lives in app.getPath('userData')/data-config.json
 */
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'data-config.json';
const DATA_FOLDER_NAME = 'PVE InvoicePro';
const UNIFIED_DB_FILE = 'database.sqlite';
const LEGACY_DB_FILE = 'gst-billing.db';
const LOCAL_DATA_FILE = 'company_local_storage.json';

/** @type {Record<string, object | null>} */
const cacheByApp = new WeakMap();

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
  }
}

function getBootstrapDir(app) {
  return app.getPath('userData');
}

function getConfigFilePath(app) {
  return path.join(getBootstrapDir(app), CONFIG_FILE);
}

function getInstallDataRoot(app) {
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(app.getAppPath(), '..');
  return path.normalize(path.join(base, 'Data', DATA_FOLDER_NAME));
}

function buildConfig(dataRoot, dataLocationType) {
  const root = path.normalize(dataRoot);
  return {
    version: 1,
    dataLocationType,
    dataRoot: root,
    databasePath: path.join(root, UNIFIED_DB_FILE),
    backupPath: path.join(root, 'backups'),
    documentsPath: path.join(root, 'documents'),
    exportsPath: path.join(root, 'exports'),
    settingsPath: path.join(root, 'settings'),
    companiesRoot: path.join(root, 'companies'),
    firstRunCompleted: false,
    profileCompleted: false,
    companyName: '',
    chosenAt: new Date().toISOString(),
  };
}

function ensureStructure(config) {
  const dirs = [
    config.dataRoot,
    config.backupPath,
    config.documentsPath,
    config.exportsPath,
    config.settingsPath,
    config.companiesRoot,
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function checkWritePermission(targetDir) {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const probe = path.join(targetDir, `.pve_write_probe_${Date.now()}`);
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
    return { ok: true, path: targetDir };
  } catch (err) {
    return { ok: false, path: targetDir, error: err?.message || String(err) };
  }
}

function rootHasCompanyData(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return false;
  return (
    fs.existsSync(path.join(rootDir, 'companies_index.json')) ||
    fs.existsSync(path.join(rootDir, 'companies')) ||
    fs.existsSync(path.join(rootDir, UNIFIED_DB_FILE)) ||
    fs.existsSync(path.join(rootDir, LEGACY_DB_FILE))
  );
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function moveEntry(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
    return true;
  } catch {
    if (fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
      fs.rmSync(src, { recursive: true, force: true });
    } else {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    }
    return true;
  }
}

function migrateLegacyFlatLayout(app, config, legacyRoot) {
  const dataRoot = config.dataRoot;
  if (path.normalize(legacyRoot) === path.normalize(dataRoot)) return { moved: false };

  const entries = ['companies_index.json', 'active_company.json', LEGACY_DB_FILE, 'companies'];
  let moved = 0;
  for (const entry of entries) {
    const src = path.join(legacyRoot, entry);
    const dest = path.join(dataRoot, entry);
    if (moveEntry(src, dest)) moved += 1;
  }
  writeConfig(app, config);
  return { moved: moved > 0, movedCount: moved };
}

function writeConfig(app, config) {
  writeJsonAtomic(getConfigFilePath(app), config);
  cacheByApp.set(app, config);
}

function readConfig(app) {
  const cached = cacheByApp.get(app);
  if (cached) return cached;
  const cfg = readJson(getConfigFilePath(app), null);
  if (cfg) cacheByApp.set(app, cfg);
  return cfg;
}

function appendStartupLog(app, payload) {
  try {
    const logPath = path.join(getBootstrapDir(app), 'profile_debug.log');
    const line = JSON.stringify({ ts: new Date().toISOString(), event: 'data_storage_startup', ...payload });
    fs.appendFileSync(logPath, `${line}\n`, 'utf8');
  } catch {
    /* ignore */
  }
}

function logStartup(app, config, companyRegistry) {
  let diagnostics = {};
  try {
    diagnostics = getStartupDiagnostics(app, companyRegistry);
  } catch (err) {
    diagnostics = { error: err?.message || String(err) };
  }
  const msg = {
    dataLocationType: config.dataLocationType,
    dataRoot: config.dataRoot,
    databasePath: config.databasePath,
    backupPath: config.backupPath,
    bootstrapDir: getBootstrapDir(app),
    configPath: getConfigFilePath(app),
    ...diagnostics,
  };
  console.log('[data-storage] startup', msg);
  appendStartupLog(app, msg);
}

function init(app, companyRegistry) {
  let config = readConfig(app);
  const bootstrap = getBootstrapDir(app);

  if (!config) {
    const legacyInBootstrap = rootHasCompanyData(bootstrap);
    const dataRoot = legacyInBootstrap
      ? bootstrap
      : path.join(bootstrap, DATA_FOLDER_NAME);
    config = buildConfig(dataRoot, 'appdata');
    config.firstRunCompleted = legacyInBootstrap;
    ensureStructure(config);
    writeConfig(app, config);

    if (!legacyInBootstrap && rootHasCompanyData(bootstrap)) {
      migrateLegacyFlatLayout(app, config, bootstrap);
    }
  } else {
    ensureStructure(config);
    cacheByApp.set(app, config);
  }

  logStartup(app, config, companyRegistry);
  return config;
}

function getConfig(app) {
  let config = readConfig(app);
  if (!config) config = init(app, null);
  return config;
}

function getDataRoot(app) {
  return getConfig(app).dataRoot;
}

function getDatabasePath(app) {
  return getConfig(app).databasePath;
}

function getBackupPath(app) {
  return getConfig(app).backupPath;
}

function getDocumentsPath(app) {
  return getConfig(app).documentsPath;
}

function getExportsPath(app) {
  return getConfig(app).exportsPath;
}

function getSettingsPath(app) {
  return getConfig(app).settingsPath;
}

function getCompaniesRoot(app) {
  return getConfig(app).companiesRoot;
}

function getLegacyDbPath(app) {
  return path.join(getBootstrapDir(app), LEGACY_DB_FILE);
}

function getIndexPath(app) {
  return path.join(getDataRoot(app), 'companies_index.json');
}

function getActivePath(app) {
  return path.join(getDataRoot(app), 'active_company.json');
}

function resolveDataRootForChoice(app, dataLocationType, customPath) {
  if (dataLocationType === 'install') {
    return getInstallDataRoot(app);
  }
  if (dataLocationType === 'custom') {
    const base = String(customPath || '').trim();
    if (!base) throw new Error('Custom folder path is required');
    return path.join(path.resolve(base), DATA_FOLDER_NAME);
  }
  return path.join(getBootstrapDir(app), DATA_FOLDER_NAME);
}

function setDataLocation(app, companyRegistry, input) {
  const type = String(input?.dataLocationType || 'appdata');
  const customPath = input?.customPath;
  const moveExisting = Boolean(input?.moveExisting);

  let targetRoot = resolveDataRootForChoice(app, type, customPath);
  const perm = checkWritePermission(targetRoot);
  if (!perm.ok && type === 'install') {
    targetRoot = path.join(getBootstrapDir(app), DATA_FOLDER_NAME);
    const fallback = buildConfig(targetRoot, 'appdata');
    ensureStructure(fallback);
    writeConfig(app, fallback);
    return {
      success: false,
      fallbackApplied: true,
      reason: 'install_folder_not_writable',
      error: perm.error,
      config: fallback,
    };
  }
  if (!perm.ok) {
    return { success: false, error: perm.error || 'Selected folder is not writable' };
  }

  const current = getConfig(app);
  const next = buildConfig(targetRoot, type);
  next.firstRunCompleted = true;
  next.profileCompleted = current.profileCompleted;
  next.companyName = current.companyName;
  ensureStructure(next);

  if (moveExisting && current.dataRoot && path.normalize(current.dataRoot) !== path.normalize(targetRoot)) {
    const toMove = [
      'companies_index.json',
      'active_company.json',
      UNIFIED_DB_FILE,
      LEGACY_DB_FILE,
      'companies',
      'backups',
      'documents',
      'exports',
      'settings',
    ];
    for (const entry of toMove) {
      moveEntry(path.join(current.dataRoot, entry), path.join(targetRoot, entry));
    }
  }

  writeConfig(app, next);
  logStartup(app, next, companyRegistry);
  return { success: true, config: next, moved: moveExisting };
}

function completeFirstRun(app, companyRegistry, choice) {
  const type = String(choice?.dataLocationType || 'appdata');
  const customPath = choice?.customPath;
  const moveExisting = Boolean(choice?.moveExisting);
  const result = setDataLocation(app, companyRegistry, { dataLocationType: type, customPath, moveExisting });
  if (!result.success && !result.fallbackApplied) return result;
  const config = result.config || getConfig(app);
  config.firstRunCompleted = true;
  writeConfig(app, config);
  return { success: true, config };
}

function scanKnownLocations(app) {
  const bootstrap = getBootstrapDir(app);
  const candidates = [
    { id: 'appdata', label: 'Recommended (AppData)', path: path.join(bootstrap, DATA_FOLDER_NAME), type: 'appdata' },
    { id: 'appdata_legacy', label: 'AppData (legacy flat)', path: bootstrap, type: 'appdata' },
    { id: 'install', label: 'Installation folder', path: getInstallDataRoot(app), type: 'install' },
  ];

  const found = [];
  for (const c of candidates) {
    const hasData = rootHasCompanyData(c.path);
    const dbCandidates = [
      path.join(c.path, UNIFIED_DB_FILE),
      path.join(c.path, LEGACY_DB_FILE),
    ];
    const dbPath = dbCandidates.find((p) => fs.existsSync(p));
    if (hasData || dbPath) {
      found.push({
        ...c,
        hasData,
        databasePath: dbPath || path.join(c.path, UNIFIED_DB_FILE),
        databaseSizeBytes: dbPath && fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
      });
    }
  }
  return found;
}

function restoreFromDetectedLocation(app, companyRegistry, sourceRoot) {
  const root = path.resolve(String(sourceRoot || ''));
  if (!rootHasCompanyData(root)) {
    return { success: false, error: 'No company data found at selected location' };
  }
  const current = getConfig(app);
  const next = { ...current, dataRoot: root };
  next.databasePath = fs.existsSync(path.join(root, UNIFIED_DB_FILE))
    ? path.join(root, UNIFIED_DB_FILE)
    : fs.existsSync(path.join(root, LEGACY_DB_FILE))
      ? path.join(root, LEGACY_DB_FILE)
      : path.join(root, UNIFIED_DB_FILE);
  next.backupPath = path.join(root, 'backups');
  next.documentsPath = path.join(root, 'documents');
  next.exportsPath = path.join(root, 'exports');
  next.settingsPath = path.join(root, 'settings');
  next.companiesRoot = path.join(root, 'companies');
  next.firstRunCompleted = true;
  ensureStructure(next);
  writeConfig(app, next);
  logStartup(app, next, companyRegistry);
  return { success: true, config: next };
}

function analyzeProfileFromDisk(app, companyRegistry) {
  if (!companyRegistry) {
    return { completed: false, reason: 'company_registry_unavailable' };
  }
  try {
    companyRegistry.ensureInitialized(app, null);
    const activeId = companyRegistry.readActiveId(app);
    if (!activeId) {
      return { completed: false, reason: 'no_active_company', companyFound: false, recordCount: 0 };
    }
    const localData = companyRegistry.readCompanyLocalData(app, activeId);
    const keyCount = Object.keys(localData || {}).length;
    const setupCompleted = localData?.setupCompleted === 'true';
    let info = {};
    try {
      info = localData?.['company-info'] ? JSON.parse(localData['company-info']) : {};
    } catch {
      info = {};
    }
    const businessName = String(info.businessName || info.name || localData?.companyName || '').trim();
    const address = String(info.address || localData?.companyAddress || '').trim();
    const phone = String(info.phone || localData?.companyPhone || '').trim();
    const profileComplete = setupCompleted || Boolean(businessName && address && phone);
    const readPath = path.join(companyRegistry.getCompanyDir(app, activeId), LOCAL_DATA_FILE);

    return {
      completed: profileComplete,
      reason: profileComplete ? 'profile_found_on_disk' : 'profile_incomplete_on_disk',
      companyFound: true,
      companyId: activeId,
      companyName: businessName,
      recordCount: keyCount,
      setupCompleted,
      readPath,
      databasePath: getDatabasePath(app),
    };
  } catch (err) {
    return { completed: false, reason: 'profile_check_error', error: err?.message || String(err) };
  }
}

function getStartupDiagnostics(app, companyRegistry) {
  const config = getConfig(app);
  const dbPath = config.databasePath;
  let dbSize = 0;
  if (fs.existsSync(dbPath)) dbSize = fs.statSync(dbPath).size;
  const profile = analyzeProfileFromDisk(app, companyRegistry);
  return {
    dataLocationType: config.dataLocationType,
    dataRoot: config.dataRoot,
    databasePath: dbPath,
    backupPath: config.backupPath,
    configPath: getConfigFilePath(app),
    bootstrapDir: getBootstrapDir(app),
    firstRunCompleted: config.firstRunCompleted,
    companyFound: profile.companyFound,
    companyName: profile.companyName || config.companyName || '',
    profileCompleted: profile.completed || config.profileCompleted,
    profileCheckReason: profile.reason,
    recordCount: profile.recordCount || 0,
    databaseSizeBytes: dbSize,
    readPath: profile.readPath,
  };
}

function markProfileCompleted(app, companyName) {
  const config = getConfig(app);
  config.profileCompleted = true;
  if (companyName) config.companyName = String(companyName).trim();
  writeConfig(app, config);
}

function getPublicConfig(app) {
  const config = getConfig(app);
  return {
    ...config,
    bootstrapDir: getBootstrapDir(app),
    configPath: getConfigFilePath(app),
    installDataRoot: getInstallDataRoot(app),
  };
}

module.exports = {
  CONFIG_FILE,
  DATA_FOLDER_NAME,
  UNIFIED_DB_FILE,
  init,
  getConfig,
  getPublicConfig,
  getDataRoot,
  getDatabasePath,
  getBackupPath,
  getDocumentsPath,
  getExportsPath,
  getSettingsPath,
  getCompaniesRoot,
  getLegacyDbPath,
  getIndexPath,
  getActivePath,
  getBootstrapDir,
  getConfigFilePath,
  getInstallDataRoot,
  checkWritePermission,
  setDataLocation,
  completeFirstRun,
  scanKnownLocations,
  restoreFromDetectedLocation,
  analyzeProfileFromDisk,
  getStartupDiagnostics,
  markProfileCompleted,
  buildConfig,
  ensureStructure,
  writeConfig,
  rootHasCompanyData,
};
