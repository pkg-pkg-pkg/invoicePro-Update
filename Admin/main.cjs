const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isDev = process.env.NODE_ENV === 'development';
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5180';

const ADMIN_STATIC_PORT = 5181;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function resolveDistDir() {
  const candidates = [];

  if (app.isPackaged) {
    candidates.push(
      path.join(app.getAppPath(), 'dist'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'dist'),
    );
  } else {
    candidates.push(path.join(__dirname, '..', 'dist'));
  }

  candidates.push(
    path.join(process.resourcesPath, 'app', 'dist'),
    path.join(app.getAppPath(), 'dist'),
  );

  for (const candidate of candidates) {
    const indexPath = path.join(candidate, 'index.html');
    if (fs.existsSync(indexPath)) return candidate;
  }

  return candidates[0];
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const root = path.resolve(rootDir);
    const server = http.createServer((req, res) => {
      try {
        const parsed = new URL(req.url || '/', 'http://127.0.0.1');
        let pathname = decodeURIComponent(parsed.pathname);
        if (pathname === '/') pathname = '/index.html';

        const relativePath = pathname.replace(/^\/+/, '').replace(/\.\.(\/|\\|$)/g, '');
        const filePath = path.join(root, relativePath);
        const normalized = path.resolve(filePath);

        if (!normalized.startsWith(root)) {
          res.writeHead(403).end('Forbidden');
          return;
        }

        if (!fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) {
          res.writeHead(404).end('Not found');
          return;
        }

        const ext = path.extname(normalized).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(normalized).pipe(res);
      } catch (error) {
        console.error('[InvoicePro Admin] static server error', error);
        res.writeHead(500).end('Internal Server Error');
      }
    });

    server.on('error', reject);
    server.listen(ADMIN_STATIC_PORT, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : ADMIN_STATIC_PORT;
      console.log('[InvoicePro Admin] static server on http://127.0.0.1:' + port, 'root:', root);
      resolve({ server, port });
    });
  });
}

function resolveWindowIcon() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'icon.ico'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'icon.png'),
    );
  }
  candidates.push(
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, 'icon.png'),
  );
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function createWindow() {
  const iconPath = resolveWindowIcon();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'InvoicePro Admin',
    icon: iconPath,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[InvoicePro Admin] did-fail-load', { code, description, url });
  });
  win.webContents.on('console-message', (_event, _level, message) => {
    console.log('[renderer]', message);
  });

  if (isDev) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const distDir = resolveDistDir();
    const indexPath = path.join(distDir, 'index.html');
    console.log('[InvoicePro Admin] dist dir:', distDir, 'exists:', fs.existsSync(indexPath));

    if (!fs.existsSync(indexPath)) {
      await win.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            '<h1>InvoicePro Admin</h1><p>Application files not found.</p><p>Please reinstall.</p>',
          ),
      );
    } else {
      const { server, port } = await startStaticServer(distDir);
      staticServer = server;
      await win.loadURL(`http://127.0.0.1:${port}/`);
    }
  }

  win.once('ready-to-show', () => win.show());

  win.on('closed', () => {
    mainWindow = null;
  });
  return win;
}

let mainWindow = null;
let staticServer = null;

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.invoicepro.admin');
  }
  mainWindow = await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
