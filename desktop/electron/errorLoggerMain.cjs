const fs = require('fs');
const path = require('path');

const LOG_FILE = 'pveb.log';
const MAX_BYTES = 5 * 1024 * 1024;

function getLogPath(app) {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, LOG_FILE);
}

function rotateIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const size = fs.statSync(filePath).size;
    if (size <= MAX_BYTES) return;
    const rotated = `${filePath}.${Date.now()}.old`;
    fs.renameSync(filePath, rotated);
  } catch {
    // ignore rotation errors
  }
}

function appendLine(app, line) {
  try {
    const filePath = getLogPath(app);
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch {
    // ignore write errors
  }
}

function init(app) {
  appendLine(app, `[${new Date().toISOString()}] [info] PVEB error logger initialized`);
}

function registerIpc(app, ipcMain) {
  ipcMain.handle('superadmin-append-log', (_event, payload) => {
    const level = String(payload?.level || 'info');
    const message = String(payload?.message || '').replace(/\s+/g, ' ').trim();
    if (!message) return { success: true };
    appendLine(app, `[${new Date().toISOString()}] [${level}] ${message}`);
    return { success: true };
  });

  ipcMain.handle('superadmin-get-log-path', () => ({
    success: true,
    path: getLogPath(app),
    logsDir: path.dirname(getLogPath(app)),
  }));

  ipcMain.handle('superadmin-read-log-file', () => {
    try {
      const filePath = getLogPath(app);
      if (!fs.existsSync(filePath)) return { success: true, content: '' };
      const content = fs.readFileSync(filePath, 'utf8');
      const tail = content.length > 120_000 ? content.slice(-120_000) : content;
      return { success: true, content: tail };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });
}

module.exports = { init, registerIpc, getLogPath };
