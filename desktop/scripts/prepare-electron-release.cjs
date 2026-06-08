/**
 * Free win-unpacked before electron-builder on Windows.
 * If the folder is locked (Explorer, IDE, antivirus), use a fresh output subfolder.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const desktopRoot = path.join(__dirname, '..');
const releasesDir = path.join(desktopRoot, 'releases');
const winUnpacked = path.join(releasesDir, 'win-unpacked');

function killStale() {
  if (process.platform !== 'win32') return;
  for (const img of ['electron.exe', 'PVE InvoicePro 360.exe', 'app-builder.exe']) {
    try {
      execSync(`taskkill /F /IM "${img}" /T 2>nul`, { stdio: 'ignore' });
    } catch {
      /* not running */
    }
  }
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function tryCleanWinUnpacked(attempts = 5) {
  if (!fs.existsSync(winUnpacked)) return true;
  for (let i = 0; i < attempts; i++) {
    try {
      rmDir(winUnpacked);
      return !fs.existsSync(winUnpacked);
    } catch {
      killStale();
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
  return !fs.existsSync(winUnpacked);
}

killStale();
const cleaned = tryCleanWinUnpacked();

let outputDir = releasesDir;
if (!cleaned) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  outputDir = path.join(releasesDir, `build-${stamp}`);
  fs.mkdirSync(outputDir, { recursive: true });
  console.warn(
    `[prepare-electron-release] win-unpacked is locked; building to ${path.relative(desktopRoot, outputDir)}`
  );
  console.warn(
    '[prepare-electron-release] Close PVE InvoicePro, Explorer windows on releases/, then delete releases/win-unpacked manually.'
  );
}

const outFile = path.join(desktopRoot, '.electron-builder-output.txt');
fs.writeFileSync(outFile, outputDir, 'utf8');
console.log(`[prepare-electron-release] output=${outputDir}`);
