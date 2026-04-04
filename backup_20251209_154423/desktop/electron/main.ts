import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import Database from 'better-sqlite3';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: Database.Database | null = null;

const isDev = process.env.NODE_ENV === 'development';

console.log('Starting Electron app...');
console.log('isDev:', isDev);

function createWindow() {
  console.log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // FIXED: removed 'electron/'
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow?.show();
  });

  // Force show for debugging
  setTimeout(() => {
    console.log('Forcing window show');
    mainWindow?.show();
  }, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    // For now, skip tray creation if icon doesn't exist
    const iconPath = path.join(__dirname, '../build/icon.png');
    if (require('fs').existsSync(iconPath)) {
      tray = new Tray(iconPath);
    } else {
      console.log('Tray icon not found, skipping tray creation');
      return;
    }
  } catch (error) {
    console.log('Tray creation failed:', error);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: 'Sync Now',
      click: () => {
        // Trigger sync
        mainWindow?.webContents.send('sync-request');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('GST Billing Software');
  tray.setContextMenu(contextMenu);
}

function initDatabase() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'gst-billing.db');
    console.log('Initializing database at:', dbPath);
    db = new Database(dbPath);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// IPC Handlers
ipcMain.handle('get-db', () => {
  return db;
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

app.whenReady().then(() => {
  console.log('App is ready, initializing...');
  initDatabase();
  createWindow();
  // createTray(); // Temporarily disabled
  console.log('Initialization complete');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
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

// Auto-updater
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}
