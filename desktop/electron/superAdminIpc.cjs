const fs = require('fs');
const os = require('os');
const path = require('path');
const { shell } = require('electron');

function countKvTotal(db) {
  if (!db) return 0;
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM kv_store').get();
    return Number(row?.c || 0);
  } catch {
    return 0;
  }
}

function countKvByPrefix(db, prefix) {
  if (!db || !prefix) return 0;
  try {
    const row = db
      .prepare('SELECT COUNT(*) AS c FROM kv_store WHERE key LIKE ?')
      .get(`${prefix}%`);
    return Number(row?.c || 0);
  } catch {
    return 0;
  }
}

function registerSuperAdminIpc({ app, getDb, dataPathManager, companyRegistry }) {
  const { ipcMain } = require('electron');

  ipcMain.handle('superadmin-get-db-status', () => {
    try {
      const db = getDb();
      const dbPath = dataPathManager.getDatabasePath(app);
      let sizeBytes = 0;
      if (dbPath && fs.existsSync(dbPath)) {
        sizeBytes = fs.statSync(dbPath).size;
      }
      let integrity = 'unknown';
      if (db) {
        try {
          const row = db.prepare('PRAGMA integrity_check').get();
          integrity = String(row?.integrity_check || row?.['integrity_check'] || 'ok');
        } catch (err) {
          integrity = `error: ${err?.message || err}`;
        }
      }
      return {
        success: true,
        dbPath: dbPath || '',
        sizeBytes,
        integrity,
        connected: Boolean(db),
        counts: {
          kvTotal: countKvTotal(db),
          customers: countKvByPrefix(db, 'customers'),
          items: countKvByPrefix(db, 'items'),
          vouchers: countKvByPrefix(db, 'vouchers'),
          parties: countKvByPrefix(db, 'parties'),
        },
      };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('superadmin-get-runtime', () => {
    const mem = process.memoryUsage();
    return {
      success: true,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      uptimeSec: Math.floor(process.uptime()),
      ramMb: Math.round(mem.rss / 1024 / 1024),
      osVersion: `${os.type()} ${os.release()}`,
      platform: process.platform,
    };
  });

  ipcMain.handle('superadmin-get-network', () => {
    const nets = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push({ name, address: net.address });
        }
      }
    }
    return { success: true, addresses, online: require('electron').net?.online ?? true };
  });

  ipcMain.handle('superadmin-open-path', async (_event, targetPath) => {
    const p = String(targetPath || '').trim();
    if (!p) return { success: false, error: 'No path' };
    const err = await shell.openPath(p);
    return err ? { success: false, error: err } : { success: true };
  });

  ipcMain.handle('superadmin-relaunch', () => {
    app.relaunch();
    app.exit(0);
    return { success: true };
  });

  ipcMain.handle('superadmin-open-db-folder', () => {
    try {
      const dbPath = dataPathManager.getDatabasePath(app);
      if (!dbPath) return { success: false, error: 'No database path' };
      return shell.openPath(path.dirname(dbPath)).then((err) =>
        err ? { success: false, error: err } : { success: true, path: path.dirname(dbPath) }
      );
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('superadmin-open-log-folder', () => {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    return shell.openPath(dir).then((err) =>
      err ? { success: false, error: err } : { success: true, path: dir }
    );
  });
}

module.exports = { registerSuperAdminIpc };
