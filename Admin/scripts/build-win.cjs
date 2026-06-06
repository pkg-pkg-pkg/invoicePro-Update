const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(process.env.TEMP || 'C:\\Temp', `invoicepro-admin-build-${stamp}`);
const distElectron = path.join(root, 'dist-electron');
const unpacked = path.join(outDir, 'win-unpacked');
const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const { appBuilderPath } = require('app-builder-bin');
const pkg = require(path.join(root, 'package.json'));

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(cmd, args = [], useShell = process.platform === 'win32') {
  const line = [cmd, ...args].join(' ');
  console.log(`\n> ${line}\n`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env, shell: useShell });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${line}`);
}

function runNpm(args) {
  run('npm', args, true);
}

function runNpx(args) {
  run(npxCmd, ['electron-builder', ...args], true);
}

function findSetupExe(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /^InvoicePro-Admin-Setup-.*\.exe$/i.test(f));
  return files.length ? path.join(dir, files[0]) : null;
}

function isUnpackedReady(dir) {
  const appAsar = path.join(dir, 'resources', 'app.asar');
  const exe = path.join(dir, 'electron.exe');
  const namedExe = path.join(dir, 'InvoicePro Admin.exe');
  return fs.existsSync(appAsar) && (fs.existsSync(exe) || fs.existsSync(namedExe));
}

function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', shell: false });
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* already exited */
    }
  }
}

function runDirWithWatch(args) {
  const line = [npxCmd, 'electron-builder', ...args].join(' ');
  console.log(`\n> ${line}\n`);

  return new Promise((resolve, reject) => {
    const child = spawn(npxCmd, ['electron-builder', ...args], {
      cwd: root,
      stdio: 'inherit',
      env,
      shell: true,
    });

    const maxMs = 60 * 60 * 1000;
    const start = Date.now();
    let finished = false;

    const finish = (err) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      if (err) reject(err);
      else resolve();
    };

    const timer = setInterval(() => {
      if (isUnpackedReady(unpacked)) {
        console.log('\nwin-unpacked ready — continuing to NSIS installer...\n');
        killProcessTree(child.pid);
        finish();
        return;
      }
      if (Date.now() - start > maxMs) {
        killProcessTree(child.pid);
        finish(new Error('win-unpacked not ready — packaging timed out'));
      }
    }, 3000);

    child.on('error', (err) => finish(err));
    child.on('exit', (code) => {
      if (isUnpackedReady(unpacked)) finish();
      else if (code === 0) finish();
      else finish(new Error(`electron-builder dir step failed (${code})`));
    });
  });
}

function ensureAppExeName(dir) {
  const electronExe = path.join(dir, 'electron.exe');
  const appExe = path.join(dir, 'InvoicePro Admin.exe');
  if (fs.existsSync(electronExe) && !fs.existsSync(appExe)) {
    fs.renameSync(electronExe, appExe);
  }
  return fs.existsSync(appExe) ? appExe : electronExe;
}

function embedAppIcon(exePath) {
  const iconIco = path.join(root, 'electron', 'icon.ico');
  if (!fs.existsSync(exePath) || !fs.existsSync(iconIco)) {
    throw new Error('Missing exe or icon.ico for icon embedding');
  }

  const args = [
    exePath,
    '--set-version-string',
    'FileDescription',
    'InvoicePro Admin',
    '--set-version-string',
    'ProductName',
    'InvoicePro Admin',
    '--set-file-version',
    pkg.version,
    '--set-product-version',
    pkg.version,
    '--set-icon',
    iconIco,
  ];

  console.log('\n> embed app icon into exe\n');
  const result = spawnSync(appBuilderPath, ['rcedit', '--args', JSON.stringify(args)], {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error('Failed to embed app icon into executable');
  }
}

function verifyPackagedMain() {
  const asar = require('@electron/asar');
  const asarPath = path.join(unpacked, 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) {
    throw new Error('app.asar missing after packaging');
  }
  const mainSource = asar.extractFile(asarPath, 'electron/main.cjs').toString('utf8');
  if (!mainSource.includes('const MIME_TYPES = {')) {
    throw new Error('Packaged main.cjs is invalid — MIME_TYPES object missing');
  }
  const checkFile = path.join(outDir, 'main-packaged-check.cjs');
  fs.writeFileSync(checkFile, mainSource);
  const check = spawnSync('node', ['--check', checkFile], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (check.status !== 0) {
    throw new Error(`Packaged main.cjs failed syntax check:\n${check.stderr || check.stdout}`);
  }
  console.log('Verified packaged electron/main.cjs');
}

function cleanNsisArtifacts(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (/\.nsis\.7z$/i.test(f) || /^InvoicePro-Admin-Setup-.*\.exe$/i.test(f)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        /* locked — another build may still be running */
      }
    }
  }
}

async function main() {
  console.log('InvoicePro Admin — Windows installer build');
  run('node', ['--check', 'electron/main.cjs'], false);
  console.log('Output temp:', outDir);
  fs.mkdirSync(outDir, { recursive: true });

  runNpm(['run', 'build:icon']);
  runNpm(['run', 'build']);

  const outArg = `--config.directories.output=${outDir.replace(/\\/g, '/')}`;
  await runDirWithWatch(['--win', 'dir', '--config', 'electron-builder.json', outArg]);

  const appExe = ensureAppExeName(unpacked);
  verifyPackagedMain();
  embedAppIcon(appExe);
  cleanNsisArtifacts(outDir);

  runNpx([
    '--prepackaged',
    unpacked,
    '--win',
    'nsis',
    '--config',
    'electron-builder.json',
    outArg,
  ]);

  const setup = findSetupExe(outDir);
  if (!setup) {
    console.error('Build finished but installer .exe not found in:', outDir);
    process.exit(1);
  }

  fs.mkdirSync(distElectron, { recursive: true });
  const dest = path.join(distElectron, path.basename(setup));
  fs.copyFileSync(setup, dest);

  console.log('\nDone.');
  console.log('Installer:', dest);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
