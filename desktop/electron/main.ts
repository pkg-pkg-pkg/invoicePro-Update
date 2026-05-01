const { app, BrowserWindow, ipcMain, Notification, Menu, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const Database = require('better-sqlite3');

let mainWindow: any = null;
let splashWindow: any = null;
let db: any = null;

const isDev = process.env.NODE_ENV === 'development';

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
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
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
    mainWindow.loadURL('http://localhost:5173');
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

  mainWindow.webContents.once('did-fail-load', () => {
    closeSplashWindow();
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

function initDatabase() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'gst-billing.db');
    console.log('Initializing database at:', dbPath);
    db = new Database(dbPath);
    db.prepare(
      'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)'
    ).run();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
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

ipcMain.handle('sync-status', async () => {
  // Check sync status
  return {
    lastSyncAt: null,
    isSyncing: false,
    pendingChanges: 0,
  };
});

ipcMain.handle('sync-now', async () => {
  // Perform sync
  return { success: true, syncedAt: new Date() };
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
    const tag = `v${String(version).replace(/^v/i, '')}`;
    const base = `https://github.com/${repo.owner}/${repo.repo}/releases/download/${tag}/`;
    const rawNames = [
      `PVE-InvoicePro-360-Setup-${version}.exe`,
      `PVE InvoicePro 360-Setup-${version}.exe`,
      `PVE-InvoicePro-360-${version}.exe`,
      `PVE InvoicePro 360-${version}.exe`,
    ];
    return rawNames.flatMap((n) => [base + n, base + encodeURIComponent(n)]);
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

ipcMain.handle('print:pdf', async (_event, payload: { html?: string; fileName?: string; landscape?: boolean }) => {
  const html = String(payload?.html ?? '');
  const suggested = String(payload?.fileName || `invoice-${Date.now()}.pdf`);
  if (!html) return null;

  let printWindow: any = null;
  try {
    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

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

ipcMain.handle('print:direct', async (_event, payload: { html?: string; silent?: boolean }) => {
  const html = String(payload?.html ?? '');
  if (!html) return false;
  let printWindow: any = null;
  try {
    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print(
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
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }
  initDatabase();
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
  if (db) {
    db.close();
  }
});
