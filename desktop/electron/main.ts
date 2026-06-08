const { app, BrowserWindow, ipcMain, Notification, Menu, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const Database = require('better-sqlite3');
const { createDesktopMobileSyncMiddleware } = require('./mobileSyncMiddleware');
const { startDesktopSyncTunnel, stopDesktopSyncTunnel } = require('./mobileSyncTunnel');
const companyRegistry = require('./companyRegistry.cjs');
const dataPathManager = require('./dataPathManager.cjs');
const profileDebug = require('./profilePersistenceDebug.cjs');
const companyProfileDb = require('./companyProfileDb.cjs');
const { registerSessionIpc } = require('./registerSessionIpc.cjs');
const { registerPincodeIpc } = require('./registerPincodeIpc.cjs');
const whatsappBridge = require('./whatsappBridge.cjs');
registerPincodeIpc();
let sessionStore: typeof import('./sessionStore.cjs');
try {
  sessionStore = require('./sessionStore.cjs');
  registerSessionIpc(app, sessionStore, companyRegistry);
} catch (sessionLoadErr) {
  console.error('[session] Failed to load sessionStore — registering fallback IPC handlers:', sessionLoadErr);
  sessionStore = {
    validateSession: () => ({ valid: false, reason: 'session_unavailable' }),
    loginWithPassword: () => ({ success: false, reason: 'Session database unavailable' }),
    registerSessionAfterLogin: () => ({
      success: false,
      reason: 'Session database unavailable. Restart the app from npm run electron:dev.',
    }),
    ensureSessionFromLegacy: () => ({ valid: false, reason: 'session_unavailable' }),
    logoutSession: () => ({ success: true }),
    touchSession: () => ({ success: false }),
    getSessionSettings: () => ({ sessionDaysDefault: 7, sessionDaysRemember: 30 }),
    setSessionSettings: () => ({ sessionDaysDefault: 7, sessionDaysRemember: 30 }),
  } as typeof sessionStore;
  registerSessionIpc(app, sessionStore, companyRegistry);
}

let mainWindow: any = null;
let splashWindow: any = null;
let db: any = null;
let mobileSyncMiddleware: any = null;
let mobileSyncTunnel: any = null;

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

console.log('Starting Electron app...');
console.log('isDev:', isDev);

function resolveWindowIcon() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'SQLOGO.png'),
      path.join(process.resourcesPath, 'dist', 'SQLOGO.png'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'invoicepro-logo.png'),
      path.join(process.resourcesPath, 'dist', 'invoicepro-logo.png')
    );
  } else {
    candidates.push(
      path.join(__dirname, '../dist/SQLOGO.png'),
      path.join(__dirname, '../public/SQLOGO.png'),
      path.join(__dirname, '../dist/invoicepro-logo.png'),
      path.join(__dirname, '../public/invoicepro-logo.png'),
      path.join(__dirname, '../dist/InvoicePro LOGO.png'),
      path.join(__dirname, '../public/InvoicePro LOGO.png')
    );
  }
  candidates.push(path.join(__dirname, 'icon.ico'));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createAppChildWindowOptions(extra: Record<string, unknown> = {}) {
  const windowIcon = resolveWindowIcon();
  return {
    autoHideMenuBar: true,
    backgroundColor: '#f4f7fb',
    ...(windowIcon ? { icon: windowIcon } : {}),
    ...extra,
  };
}

function getPrintToolbarLogoDataUri(): string {
  const iconPath = resolveWindowIcon();
  if (!iconPath) return '';
  try {
    const ext = path.extname(iconPath).toLowerCase();
    const mime = ext === '.ico' ? 'image/x-icon' : 'image/png';
    return `data:${mime};base64,${fs.readFileSync(iconPath).toString('base64')}`;
  } catch {
    return '';
  }
}

/** First path that exists for a file under dist/ in a packaged build. */
function resolvePackagedDistFile(filename: string) {
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', filename),
    path.join(app.getAppPath(), 'dist', filename),
    path.join(process.resourcesPath, 'dist', filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function resolveSplashPath(): string | null {
  if (isDev) {
    const pub = path.join(__dirname, '../public/splashscreen.html');
    return fs.existsSync(pub) ? pub : null;
  }
  if (!app.isPackaged) {
    const distPath = path.join(__dirname, '../dist/splashscreen.html');
    if (fs.existsSync(distPath)) return distPath;
    const pub = path.join(__dirname, '../public/splashscreen.html');
    return fs.existsSync(pub) ? pub : null;
  }
  const p = resolvePackagedDistFile('splashscreen.html');
  return fs.existsSync(p) ? p : null;
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

function createSplashWindow() {
  closeSplashWindow();
  const splashPath = resolveSplashPath();
  if (!splashPath) {
    console.log('Splash screen not found, skipping');
    return;
  }
  const windowIcon = resolveWindowIcon();
  splashWindow = new BrowserWindow({
    width: 560,
    height: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#1f4037',
    alwaysOnTop: true,
    show: false,
    center: true,
    resizable: false,
    skipTaskbar: true,
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      devTools: false,
    },
  });
  splashWindow.loadFile(splashPath);
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show();
  });
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow() {
  console.log('Creating main window...');
  const windowIcon = resolveWindowIcon();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b1628',
    frame: process.platform === 'darwin',
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Load HTML file from correct location
    try {
      const isPackaged = app.isPackaged;

      let indexPath: string;
      if (isPackaged) {
        // In packaged app, load from unpacked dist folder
        indexPath = path.join((process as any).resourcesPath, 'app.asar.unpacked', 'dist', 'index.html');
      } else {
        // Development/production build - files are in ../dist relative to electron folder
        indexPath = path.join(__dirname, '../dist/index.html');
      }

      console.log('Loading app from:', indexPath);
      console.log('File exists:', require('fs').existsSync(indexPath));

      if (require('fs').existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        console.error('Index file not found at:', indexPath);
        // Try multiple fallback paths
        const fallbackPaths = [
          path.join((process as any).resourcesPath, 'dist', 'index.html'),
          path.join((process as any).resourcesPath, 'app.asar.unpacked', 'dist', 'index.html'),
          path.join(__dirname, '../dist/index.html'),
          path.join(__dirname, '../../dist/index.html'),
          path.join(process.cwd(), 'dist', 'index.html'),
        ];

        let loaded = false;
        for (const fallbackPath of fallbackPaths) {
          console.log('Trying fallback path:', fallbackPath);
          if (require('fs').existsSync(fallbackPath)) {
            console.log('Found file at fallback path, loading...');
            mainWindow.loadFile(fallbackPath);
            loaded = true;
            break;
          }
        }

        if (!loaded) {
          console.error('All fallback paths failed');
          // Last resort: show error message
          mainWindow.loadURL(`data:text/html,
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>Application Error</h1>
                    <p>The application files could not be found.</p>
                    <p>Please reinstall the application.</p>
                    <p><strong>Error:</strong> index.html not found at expected locations</p>
                    <p><small>Primary path: ${indexPath}</small></p>
              </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Error loading application:', error);
      mainWindow.loadURL(`data:text/html,
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h1>Application Error</h1>
                <p>Failed to load the application.</p>
                <p><strong>Error:</strong> ${error}</p>
              </body>
        </html>
      `);
    }
  }

  const showLoadErrorPage = (errorCode: number, errorDescription: string, validatedURL: string) => {
    closeSplashWindow();
    console.error('[window] did-fail-load', errorCode, errorDescription, validatedURL);
    const devHint = isDev
      ? `<p><strong>Development:</strong> Close this app and run from the <code>desktop</code> folder:</p>
         <pre style="background:#0f172a;padding:12px;border-radius:8px;">npm run electron:dev</pre>
         <p>Wait until Vite shows <em>ready</em> on port 5173, then the window will load.</p>`
      : `<p><strong>Production:</strong> Rebuild the UI, then start Electron:</p>
         <pre style="background:#0f172a;padding:12px;border-radius:8px;">npm run build
npm run electron</pre>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Load failed</title></head>
      <body style="margin:0;font-family:Segoe UI,sans-serif;background:#0b1628;color:#e2e8f0;padding:32px;line-height:1.5;">
        <h1 style="color:#ffc107;margin-top:0;">PVE InvoicePro 360 could not start</h1>
        <p>The window opened but the app page did not load.</p>
        ${devHint}
        <p style="color:#94a3b8;font-size:13px;">URL: ${validatedURL || 'unknown'}<br/>Error ${errorCode}: ${errorDescription || 'failed'}</p>
      </body></html>`;
    if (mainWindow && !mainWindow.isDestroyed()) {
      void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      mainWindow.show();
    }
  };

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    showLoadErrorPage(errorCode, errorDescription, validatedURL);
  });

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    closeSplashWindow();
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => {
    try {
      mainWindow?.webContents.send('window-state-changed', true);
    } catch {
      /* ignore */
    }
  });
  mainWindow.on('unmaximize', () => {
    try {
      mainWindow?.webContents.send('window-state-changed', false);
    } catch {
      /* ignore */
    }
  });
}

function closeDatabase() {
  try {
    if (db) db.close();
  } catch {
    /* ignore */
  }
  db = null;
}

function initDatabase(companyId?: string) {
  try {
    closeDatabase();
    companyRegistry.ensureInitialized(app, null);
    const id = companyId || companyRegistry.readActiveId(app);
    const dbPath = companyRegistry.getCompanyDbPath(app, id);
    const legacyDbPath = dataPathManager.getLegacyDbPath(app);
    const companyLegacyDb = path.join(path.dirname(dbPath), 'gst-billing.db');
    if (!fs.existsSync(dbPath) && fs.existsSync(companyLegacyDb) && companyLegacyDb !== dbPath) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.copyFileSync(companyLegacyDb, dbPath);
      profileDebug.appendLog(app, 'db_reuse_company_legacy', { from: companyLegacyDb, to: dbPath, companyId: id });
    } else if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.copyFileSync(legacyDbPath, dbPath);
      profileDebug.appendLog(app, 'db_reuse_legacy', { from: legacyDbPath, to: dbPath, companyId: id });
      console.log('[profile-debug] Reused legacy SQLite at', dbPath);
    }
    console.log('[profile-debug] Initializing SQLite at:', dbPath, 'userData:', app.getPath('userData'));
    db = new Database(dbPath);
    companyProfileDb.ensureSchema(db);
    const migration = companyProfileDb.migrateFromLocalJsonIfNeeded(
      app,
      db,
      companyRegistry,
      dataPathManager
    );
    profileDebug.appendLog(app, 'profile_db_migration', migration);
    profileDebug.appendLog(app, 'db_init', {
      companyId: id,
      dbPath,
      userDataPath: app.getPath('userData'),
      exists: fs.existsSync(dbPath),
    });
    console.log('[profile-debug] SQLite ready for company', id);
  } catch (error) {
    console.error('[profile-debug] Database initialization failed:', error);
    profileDebug.appendLog(app, 'db_init_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function readKvSyncState(key: string, fallback: unknown) {
  if (!db) return fallback;
  try {
    const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as any;
    if (!row?.value) return fallback;
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function writeKvSyncState(key: string, value: unknown) {
  if (!db) return;
  try {
    db.prepare(
      'INSERT INTO kv_store(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).run(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to write sync state', error);
  }
}

function mobileSyncToken() {
  const fromEnv = String(process.env.DESKTOP_SYNC_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  const saved = String(readKvSyncState('mobile_sync_token', '') || '').trim();
  if (saved) return saved;
  const generated = `sync_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  writeKvSyncState('mobile_sync_token', generated);
  return generated;
}

function startEmbeddedMobileSync() {
  if (mobileSyncMiddleware) return;
  mobileSyncMiddleware = createDesktopMobileSyncMiddleware({
    port: Number(process.env.DESKTOP_SYNC_PORT || 3399),
    authTokenProvider: () => mobileSyncToken(),
    loadState: () => readKvSyncState('mobile_sync_state', {}),
    persistState: (state: unknown) => writeKvSyncState('mobile_sync_state', state),
    getEntitlements: () => readKvSyncState('mobile_user_entitlements_v1', { users: [] }),
    persistEntitlements: (value: unknown) => writeKvSyncState('mobile_user_entitlements_v1', value),
    getSnapshot: () => readKvSyncState('mobile_data_snapshot_v1', null),
    onDeviceBind: (payload: unknown) => {
      broadcastUpdate('mobile-device-bound', payload);
    },
    onStatus: (status: unknown) => {
      broadcastUpdate('mobile-sync-status', status);
    },
    onRetry: async () => {
      const drained = mobileSyncMiddleware?.drainInbox?.(500) || [];
      broadcastUpdate('mobile-sync-drain', { drainedCount: drained.length });
    },
  });
  mobileSyncMiddleware.start();

  startDesktopSyncTunnel(Number(process.env.DESKTOP_SYNC_PORT || 3399))
    .then((tunnel: any) => {
      mobileSyncTunnel = tunnel;
      if (mobileSyncTunnel?.url) {
        mobileSyncMiddleware?.setPublicEndpoint?.(mobileSyncTunnel.url, true);
      }
    })
    .catch(() => {
      mobileSyncMiddleware?.setPublicEndpoint?.(null, false);
    });
}

// IPC Handlers
ipcMain.handle('get-db', () => {
  return db;
});

ipcMain.handle('kv-read', (_event, key: string) => {
  if (!db) return null;
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as any;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
});

ipcMain.handle('kv-write', (_event, key: string, value: unknown) => {
  if (!db) return false;
  const payload = JSON.stringify(value);
  db.prepare(
    'INSERT INTO kv_store(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, payload);
  return true;
});

ipcMain.handle('kv-remove', (_event, key: string) => {
  if (!db) return false;
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
  return true;
});

ipcMain.handle('company-profile-get-active', () => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    const companyCode = companyRegistry.readActiveId(app);
    const profile = companyProfileDb.getProfileByCode(db, companyCode);
    return { success: true, companyCode, profile };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('company-profile-upsert', (_event, payload: Record<string, unknown>) => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    const companyCode = String(payload?.companyCode || companyRegistry.readActiveId(app) || '');
    if (!companyCode) return { success: false, error: 'No active company' };
    const profile = companyProfileDb.upsertProfile(db, companyCode, payload || {});
    return { success: true, companyCode, profile };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('company-profile-mark-completed', (_event, payload: Record<string, unknown>) => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    const companyCode = String(payload?.companyCode || companyRegistry.readActiveId(app) || '');
    const companyName = String(payload?.companyName || '');
    const result = companyProfileDb.markProfileCompleted(db, companyCode, companyName);
    return { ...result, companyCode };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('company-profile-completion-status', () => {
  try {
    if (!db) {
      return {
        success: true,
        profileCompleted: false,
        companyExists: false,
        reason: 'no_database',
        migrationStatus: 'pending',
        databasePath: dataPathManager.getDatabasePath(app),
      };
    }
    const companyCode = companyRegistry.readActiveId(app);
    const diagnostics = companyProfileDb.getStartupDiagnostics(
      app,
      db,
      companyRegistry,
      dataPathManager,
      companyCode
    );
    return { success: true, ...diagnostics };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('company-profile-run-migration', () => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    const result = companyProfileDb.migrateFromLocalJsonIfNeeded(
      app,
      db,
      companyRegistry,
      dataPathManager
    );
    return { success: true, ...result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('companies-ensure-initialized', (_event, localData: Record<string, string>) => {
  const res = companyRegistry.ensureInitialized(app, localData || {});
  if (res.activeId) initDatabase(res.activeId);
  return res;
});

ipcMain.handle('companies-list', () => companyRegistry.listCompanies(app));

ipcMain.handle('companies-list-enriched', () => companyRegistry.listCompaniesEnriched(app));

ipcMain.handle('companies-set-default', (_event, companyId: string) =>
  companyRegistry.setDefaultCompany(app, companyId)
);

ipcMain.handle('companies-get-active', () => companyRegistry.getActiveCompany(app));

ipcMain.handle('companies-create', (_event, payload: Record<string, unknown>) => {
  const res = companyRegistry.createCompany(
    app,
    payload || {},
    (payload?.currentLocalData as Record<string, string>) || {}
  );
  initDatabase(res.activeId);
  const active = companyRegistry.getActiveCompany(app);
  return { ...active, activeId: res.activeId };
});

ipcMain.handle(
  'companies-switch',
  (_event, payload: { targetId?: string; currentLocalData?: Record<string, string> }) => {
    const res = companyRegistry.switchCompany(
      app,
      payload?.targetId || '',
      payload?.currentLocalData || {}
    );
    initDatabase(res.activeId);
    sessionStore.touchSession(app, res.activeId);
    const active = companyRegistry.getActiveCompany(app);
    return { ...active, activeId: res.activeId };
  }
);

ipcMain.handle(
  'companies-delete',
  (_event, payload: { companyId?: string; currentLocalData?: Record<string, string> }) => {
    const res = companyRegistry.deleteCompany(
      app,
      payload?.companyId || '',
      payload?.currentLocalData || {}
    );
    if (res.switched && res.activeId) {
      initDatabase(res.activeId);
      sessionStore.touchSession(app, res.activeId);
      const active = companyRegistry.getActiveCompany(app);
      return { ...res, ...active };
    }
    return res;
  }
);

ipcMain.handle('company-settings-read', () => {
  try {
    const id = companyRegistry.readActiveId(app);
    if (!id) {
      console.error('[company-settings-read] no active company id');
      return { success: false, error: 'No active company', settings: companyRegistry.DEFAULT_COMPANY_SETTINGS };
    }
    const settings = companyRegistry.readCompanySettings(app, id);
    return { success: true, settings };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[company-settings-read] failed', err);
    return { success: false, error: message, settings: companyRegistry.DEFAULT_COMPANY_SETTINGS };
  }
});

ipcMain.handle('company-settings-write', (_event, partial: Record<string, unknown>) => {
  try {
    const id = companyRegistry.readActiveId(app);
    if (!id) {
      console.error('[company-settings-write] no active company id');
      return { success: false, error: 'No active company' };
    }
    return companyRegistry.writeCompanySettings(app, id, partial || {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[company-settings-write] failed', err);
    return { success: false, error: message };
  }
});

ipcMain.handle('company-local-data-persist', (_event, localData: Record<string, string>) => {
  try {
    const id = companyRegistry.readActiveId(app);
    if (!id) return { success: false, error: 'No active company' };
    const result = companyRegistry.persistCompanyLocalData(app, id, localData || {});
    profileDebug.logPersistResult(app, result);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[company-local-data-persist] failed', err);
    profileDebug.logPersistResult(app, { success: false, error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('profile-debug-scan', () => {
  try {
    return profileDebug.scanProfilePersistence(app, companyRegistry);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('profile-debug-log', (_event, payload: Record<string, unknown>) => {
  try {
    profileDebug.logRendererEvent(app, payload || {});
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('profile-debug-log-path', () => {
  try {
    return { path: profileDebug.getLogPath(app) };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-get-config', () => {
  try {
    dataPathManager.init(app, companyRegistry);
    return { success: true, config: dataPathManager.getPublicConfig(app) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-get-diagnostics', () => {
  try {
    dataPathManager.init(app, companyRegistry);
    return { success: true, diagnostics: dataPathManager.getStartupDiagnostics(app, companyRegistry) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-scan-locations', () => {
  try {
    return { success: true, locations: dataPathManager.scanKnownLocations(app) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-set-location', (_event, payload: Record<string, unknown>) => {
  try {
    return dataPathManager.setDataLocation(app, companyRegistry, payload || {});
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-complete-first-run', (_event, payload: Record<string, unknown>) => {
  try {
    return dataPathManager.completeFirstRun(app, companyRegistry, payload || {});
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-restore-detected', (_event, sourceRoot: string) => {
  try {
    return dataPathManager.restoreFromDetectedLocation(app, companyRegistry, sourceRoot);
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-check-write', (_event, targetDir: string) => {
  try {
    return dataPathManager.checkWritePermission(String(targetDir || ''));
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-open-path', (_event, targetPath: string) => {
  try {
    const p = String(targetPath || '').trim();
    if (!p) return { success: false };
    shell.openPath(p);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('data-storage-show-in-folder', (_event, targetPath: string) => {
  try {
    const p = String(targetPath || '').trim();
    if (!p) return { success: false };
    shell.showItemInFolder(p);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('sync-status', async () => {
  // Check sync status
  return {
    lastSyncAt: null,
    isSyncing: false,
    pendingChanges: 0,
    mobileSync: mobileSyncMiddleware?.getStatus?.() || null,
  };
});

ipcMain.handle('sync-now', async () => {
  // Perform sync
  if (mobileSyncMiddleware?.retryNow) {
    await mobileSyncMiddleware.retryNow();
  }
  return { success: true, syncedAt: new Date(), mobileSync: mobileSyncMiddleware?.getStatus?.() || null };
});

ipcMain.handle('mobile-sync-status', async () => {
  const status = mobileSyncMiddleware?.getStatus?.() || null;
  return {
    token: mobileSyncToken(),
    localEndpoint: `http://127.0.0.1:${Number(process.env.DESKTOP_SYNC_PORT || 3399)}/mobile-sync`,
    status,
  };
});

ipcMain.handle('mobile-sync-retry', async () => {
  await mobileSyncMiddleware?.retryNow?.();
  return mobileSyncMiddleware?.getStatus?.() || null;
});

ipcMain.handle('mobile-sync-publish-change', async (_event, change: unknown) => {
  mobileSyncMiddleware?.publishDesktopChange?.(change);
  return true;
});

ipcMain.handle('mobile-entitlements-sync', async (_event, payload: unknown) => {
  writeKvSyncState('mobile_user_entitlements_v1', payload);
  return true;
});

ipcMain.handle('mobile-snapshot-publish', async (_event, snapshot: unknown) => {
  writeKvSyncState('mobile_data_snapshot_v1', {
    ...(typeof snapshot === 'object' && snapshot ? snapshot : {}),
    publishedAt: new Date().toISOString(),
  });
  mobileSyncMiddleware?.publishDesktopChange?.({ kind: 'snapshot_updated' });
  return true;
});

function broadcastUpdate(channel: string, payload: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

function formatReleaseNotes(info: any): string | undefined {
  const n = info?.releaseNotes;
  if (typeof n === 'string') return n;
  if (Array.isArray(n))
    return n
      .map((x: any) => (typeof x === 'string' ? x : x?.note || ''))
      .filter(Boolean)
      .join('\n');
  return undefined;
}

function configureAutoUpdater() {
  let lastUpdateInfo: any = null;

  const resolveGitHubRepo = (): { owner: string; repo: string } | null => {
    try {
      const pkg = require('../package.json');
      const raw = String(pkg?.repository?.url ?? '').trim();
      const m = raw.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i);
      if (!m) return null;
      return { owner: m[1], repo: m[2] };
    } catch {
      return null;
    }
  };

  const urlExists = (url: string): Promise<boolean> =>
    new Promise((resolve) => {
      const req = https.request(url, { method: 'HEAD' }, (res: any) => {
        const code = Number(res?.statusCode ?? 0);
        resolve(code >= 200 && code < 400);
      });
      req.on('error', () => resolve(false));
      req.end();
    });

  const buildFallbackAssetUrls = (version: string): string[] => {
    const repo = resolveGitHubRepo();
    if (!repo || !version) return [];
    const ver = String(version).replace(/^v/i, '');
    const tags = [`v${ver}`, `V${ver}`, ver];
    const rawNames = [
      `PVE-InvoicePro-360-Setup-${ver}.exe`,
      `PVE InvoicePro 360-Setup-${ver}.exe`,
      `PVE-InvoicePro-360-${ver}.exe`,
      `PVE InvoicePro 360-${ver}.exe`,
      `GST Billing Software-Setup-${ver}.exe`,
    ];
    return tags.flatMap((tag) => {
      const base = `https://github.com/${repo.owner}/${repo.repo}/releases/download/${tag}/`;
      return rawNames.flatMap((n) => [base + n, base + encodeURIComponent(n)]);
    });
  };

  const tryFallbackManualDownload = async (version: string): Promise<string | null> => {
    const candidates = buildFallbackAssetUrls(version);
    for (const url of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await urlExists(url)) {
        await shell.openExternal(url);
        return url;
      }
    }
    return null;
  };

  if (!app.isPackaged) {
    ipcMain.handle('check-for-updates', async () => ({
      updateAvailable: false,
      currentVersion: app.getVersion(),
    }));
    ipcMain.handle('download-update', async () => false);
    ipcMain.handle('install-update', async () => true);
    return;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    lastUpdateInfo = info;
    broadcastUpdate('update-available', info);
    if (Notification.isSupported()) {
      try {
        new Notification({
          title: 'GST Billing Software',
          body: `Version ${info.version} available. Open Settings → About & Updates to download.`,
        }).show();
      } catch {
        /* ignore */
      }
    }
  });
  autoUpdater.on('update-not-available', (info) => {
    broadcastUpdate('update-not-available', info);
  });
  autoUpdater.on('download-progress', (p) => {
    broadcastUpdate('download-progress', {
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      speed: p.bytesPerSecond,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdate('update-downloaded', info);
  });
  autoUpdater.on('error', (err) => {
    broadcastUpdate('update-error', { message: err.message || String(err) });
  });
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      const cur = app.getVersion();
      if (result?.updateInfo) {
        lastUpdateInfo = result.updateInfo;
        return {
          updateAvailable: Boolean(result.isUpdateAvailable),
          currentVersion: cur,
          newVersion: result.updateInfo.version,
          releaseNotes: formatReleaseNotes(result.updateInfo),
          releaseDate: result.updateInfo.releaseDate,
        };
      }
      return { updateAvailable: false, currentVersion: cur };
    } catch (e) {
      console.error('check-for-updates failed:', e);
      throw e;
    }
  });
  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (e: any) {
      const message = String(e?.message || e || '');
      const isNotFound = /status\s*404/i.test(message) || /Not Found/i.test(message);
      if (!isNotFound) throw e;

      const targetVersion = String(lastUpdateInfo?.version ?? '').trim();
      if (targetVersion) {
        const fallbackUrl = await tryFallbackManualDownload(targetVersion);
        if (fallbackUrl) {
          throw new Error(
            `Auto-update asset mismatch (404). Manual installer opened: ${fallbackUrl}. ` +
              'Please upload latest.yml + setup exe for seamless in-app updates.'
          );
        }
      }
      throw new Error(
        'Auto-update asset not found on release (404). Please upload latest.yml and matching setup exe to the tagged release.'
      );
    }
  });
  ipcMain.handle('install-update', async () => {
    autoUpdater.quitAndInstall(false, true);
    return true;
  });
}

configureAutoUpdater();

ipcMain.handle('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});
ipcMain.handle('window-toggle-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});
ipcMain.handle('window-is-maximized', () =>
  Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized())
);
ipcMain.handle('open-external-url', async (_event, rawUrl: string) => {
  try {
    const url = String(rawUrl || '').trim();
    if (!url) return false;
    if (!/^(https?|whatsapp):\/\//i.test(url)) return false;
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('whatsapp-check-status', async () => whatsappBridge.checkWhatsAppStatus());
ipcMain.handle('whatsapp-open-chat', async (_event, phone: string, message: string) =>
  whatsappBridge.openWhatsAppChat(phone, message)
);

ipcMain.handle('print:pdf', async (_event, payload: { html?: string; fileName?: string; landscape?: boolean }) => {
  const html = String(payload?.html ?? '');
  const suggested = String(payload?.fileName || `invoice-${Date.now()}.pdf`);
  if (!html) return null;

  let printWindow: any = null;
  try {
    printWindow = new BrowserWindow(createAppChildWindowOptions({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    }));

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      landscape: Boolean(payload?.landscape),
      pageSize: 'A4',
      margins: { marginType: 'default' },
    });
    const saveResult = await dialog.showSaveDialog(mainWindow || undefined, {
      title: 'Save Invoice PDF',
      defaultPath: suggested.endsWith('.pdf') ? suggested : `${suggested}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return null;
    fs.writeFileSync(saveResult.filePath, pdfBuffer);
    return saveResult.filePath;
  } catch (error) {
    console.error('print:pdf failed', error);
    return null;
  } finally {
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
});

const wrapPrintPreviewHtml = (html: string): string => {
  if (html.includes('pve-print-toolbar')) return html;
  const logoUri = getPrintToolbarLogoDataUri();
  const logoHtml = logoUri
    ? `<img src="${logoUri}" alt="PVE" style="width:24px;height:24px;border-radius:5px;object-fit:contain;background:#fff;padding:2px;" />`
    : `<span style="display:inline-flex;width:24px;height:24px;border-radius:5px;background:#fff;color:#1f4e79;font-weight:800;font-size:10px;align-items:center;justify-content:center;">PVE</span>`;
  const toolbar = `<div id="pve-print-toolbar" style="position:sticky;top:0;z-index:9999;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 14px;background:#1f4e79;color:#fff;font-family:Segoe UI,Arial,sans-serif;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.15);"><div style="display:flex;align-items:center;gap:10px;">${logoHtml}<div><strong style="display:block;line-height:1.2;">PVE InvoicePro 360</strong><span style="font-size:12px;opacity:.88;font-weight:500;">Print Preview</span></div></div><div style="display:flex;gap:8px;"><button type="button" onclick="window.print()" style="cursor:pointer;padding:6px 14px;border:none;border-radius:4px;background:#fff;color:#1f4e79;font-weight:600;">Print</button><button type="button" onclick="window.close()" style="cursor:pointer;padding:6px 14px;border:1px solid #fff;border-radius:4px;background:transparent;color:#fff;">Close</button></div></div>`;
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);
  }
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${toolbar}${html}</body></html>`;
};

ipcMain.handle('print:open-preview', async (_event, payload: { html?: string }) => {
  const html = String(payload?.html ?? '');
  if (!html) return false;
  let previewWindow: BrowserWindow | null = null;
  try {
    previewWindow = new BrowserWindow(createAppChildWindowOptions({
      show: true,
      width: 980,
      height: 920,
      title: 'PVE InvoicePro 360 — Print Preview',
      webPreferences: { sandbox: false },
    }));
    const doc = wrapPrintPreviewHtml(html);
    await previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(doc)}`);
    previewWindow.on('closed', () => {
      previewWindow = null;
    });
    return true;
  } catch (error) {
    console.error('print:open-preview failed', error);
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.close();
    }
    return false;
  }
});

ipcMain.handle('print:direct', async (_event, payload: { html?: string; silent?: boolean }) => {
  const html = String(payload?.html ?? '');
  if (!html) return false;
  let printWindow: BrowserWindow | null = null;
  try {
    printWindow = new BrowserWindow(createAppChildWindowOptions({
      show: true,
      width: 980,
      height: 920,
      title: 'PVE InvoicePro 360 — Print',
      webPreferences: { sandbox: false },
    }));
    const doc = wrapPrintPreviewHtml(html);
    await new Promise<void>((resolve, reject) => {
      printWindow!.webContents.once('did-finish-load', () => resolve());
      printWindow!.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`${code}: ${desc}`)));
      void printWindow!.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(doc)}`);
    });
    await new Promise<void>((resolve, reject) => {
      printWindow!.webContents.print(
        {
          silent: Boolean(payload?.silent),
          printBackground: true,
        },
        (success: boolean, errorType: string) => {
          if (!success && errorType) {
            reject(new Error(errorType));
            return;
          }
          resolve();
        }
      );
    });
    return true;
  } catch (error) {
    console.error('print:direct failed', error);
    return false;
  } finally {
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
});

app.whenReady().then(() => {
  console.log('App is ready, initializing...');
  dataPathManager.init(app, companyRegistry);
  registerSessionIpc(app, sessionStore, companyRegistry);
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }
  companyRegistry.ensureInitialized(app, null);
  initDatabase(companyRegistry.readActiveId(app));
  startEmbeddedMobileSync();
  createSplashWindow();
  createWindow();
  console.log('Initialization complete');

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e: Error) => console.warn('Background update check:', e.message));
    }, 15000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    mobileSyncMiddleware?.stop?.();
  } catch {
    // ignore
  }
  void stopDesktopSyncTunnel();
  if (db) {
    db.close();
  }
});
