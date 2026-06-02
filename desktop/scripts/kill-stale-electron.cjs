/**
 * Ends stale InvoicePro / Electron processes that block port 5173 and old IPC handlers.
 */
const { execSync } = require('child_process');

if (process.platform !== 'win32') {
  process.exit(0);
}

try {
  execSync('taskkill /F /IM electron.exe /T 2>nul', { stdio: 'ignore' });
} catch {
  /* none running */
}
