/**
 * Pincode lookup via main process (avoids renderer fetch / TLS edge cases in Electron).
 */
const { ipcMain } = require('electron');
const https = require('https');

function fetchPincodeJson(pin) {
  const digits = String(pin || '').replace(/\D/g, '');
  if (digits.length !== 6) return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = `https://api.postalpincode.in/pincode/${digits}`;
    const req = https.get(
      url,
      { headers: { Accept: 'application/json', 'User-Agent': 'PVE-InvoicePro/1.0' }, timeout: 12000 },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function registerPincodeIpc() {
  try {
    ipcMain.removeHandler('pincode-lookup');
  } catch {
    /* ignore */
  }
  ipcMain.handle('pincode-lookup', async (_event, pin) => fetchPincodeJson(pin));
}

module.exports = { registerPincodeIpc, fetchPincodeJson };
