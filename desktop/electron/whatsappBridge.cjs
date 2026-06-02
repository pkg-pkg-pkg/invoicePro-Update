const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { execFile } = require('child_process');

function openExternalWithFallback(url) {
  return new Promise((resolve) => {
    shell
      .openExternal(url)
      .then((ok) => {
        if (ok) {
          resolve(true);
          return;
        }
        if (process.platform !== 'win32') {
          resolve(false);
          return;
        }
        execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, (err) => resolve(!err));
      })
      .catch(() => {
        if (process.platform !== 'win32') {
          resolve(false);
          return;
        }
        execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, (err) => resolve(!err));
      });
  });
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

function hasWhatsAppProtocolHandler() {
  if (process.platform !== 'win32') return false;
  try {
    const { execSync } = require('child_process');
    const out = execSync('reg query "HKCU\\Software\\Classes\\whatsapp\\shell\\open\\command"', {
      encoding: 'utf8',
      timeout: 3000,
    });
    return /whatsapp/i.test(out);
  } catch {
    try {
      const { execSync } = require('child_process');
      const out = execSync('reg query "HKLM\\Software\\Classes\\whatsapp\\shell\\open\\command"', {
        encoding: 'utf8',
        timeout: 3000,
      });
      return /whatsapp/i.test(out);
    } catch {
      return false;
    }
  }
}

function findWhatsAppDesktopExe() {
  const localApp = process.env.LOCALAPPDATA || '';
  const candidates = [path.join(localApp, 'WhatsApp', 'WhatsApp.exe')];

  if (process.platform === 'win32') {
    const pf86 = process.env['ProgramFiles(x86)'] || '';
    const pf = process.env.ProgramFiles || '';
    candidates.push(path.join(pf86, 'WhatsApp', 'WhatsApp.exe'));
    candidates.push(path.join(pf, 'WhatsApp', 'WhatsApp.exe'));
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/WhatsApp.app');
  }

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }

  try {
    const waDir = path.join(localApp, 'WhatsApp');
    if (!fs.existsSync(waDir)) return null;
    for (const entry of fs.readdirSync(waDir)) {
      if (!entry.startsWith('app-')) continue;
      const exe = path.join(waDir, entry, 'WhatsApp.exe');
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    // ignore
  }

  return null;
}

function isWhatsAppDesktopAvailable() {
  return Boolean(findWhatsAppDesktopExe()) || hasWhatsAppProtocolHandler();
}

function buildDesktopUrl(phone, message) {
  const p = normalizePhone(phone);
  const text = encodeURIComponent(String(message || ''));
  return `whatsapp://send?phone=${p}&text=${text}`;
}

function buildWebUrl(phone, message) {
  const p = normalizePhone(phone);
  const text = encodeURIComponent(String(message || ''));
  return `https://web.whatsapp.com/send?phone=${p}&text=${text}`;
}

function buildWaMeUrl(phone, message) {
  const p = normalizePhone(phone);
  const text = encodeURIComponent(String(message || ''));
  return p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Passive check — WhatsApp Desktop installed on this PC. */
function checkWhatsAppStatus() {
  if (isWhatsAppDesktopAvailable()) {
    return {
      ok: true,
      mode: 'desktop',
      status: 'Connected',
      desktopPath: findWhatsAppDesktopExe(),
    };
  }
  return {
    ok: false,
    mode: 'none',
    status: 'Not connected',
    desktopPath: null,
  };
}

/**
 * Open customer chat with pre-filled message. User sends manually in WhatsApp.
 * Uses wa.me first (most reliable on Windows), then whatsapp://, then WhatsApp Web.
 */
async function openWhatsAppChat(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { ok: false, mode: 'none', status: 'Not connected', error: 'Invalid phone number' };
  }

  const desktop = isWhatsAppDesktopAvailable();
  const attempts = [
    { url: buildWaMeUrl(phone, message), mode: desktop ? 'desktop' : 'web' },
    { url: buildDesktopUrl(phone, message), mode: 'desktop' },
    { url: buildWebUrl(phone, message), mode: 'web' },
  ];

  let lastError = 'Could not open WhatsApp';
  for (const attempt of attempts) {
    try {
      const opened = await openExternalWithFallback(attempt.url);
      if (!opened) continue;
      return {
        ok: true,
        mode: attempt.mode,
        status: attempt.mode === 'desktop' ? 'Connected' : 'Connected (Web)',
      };
    } catch (err) {
      lastError = String(err?.message || err || lastError);
    }
  }

  return {
    ok: false,
    mode: 'none',
    status: 'Not connected',
    error: lastError,
  };
}

module.exports = {
  normalizePhone,
  findWhatsAppDesktopExe,
  checkWhatsAppStatus,
  openWhatsAppChat,
  buildWaMeUrl,
};
