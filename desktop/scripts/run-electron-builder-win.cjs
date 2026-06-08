const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const desktopRoot = path.join(__dirname, '..');
const outFile = path.join(desktopRoot, '.electron-builder-output.txt');
const output =
  fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').trim()
    ? fs.readFileSync(outFile, 'utf8').trim()
    : path.join(desktopRoot, 'releases');

const relOutput = path.relative(desktopRoot, output).replace(/\\/g, '/');

const result = spawnSync(
  'npx',
  ['electron-builder', '--win', `-c.directories.output=${relOutput}`],
  { cwd: desktopRoot, stdio: 'inherit', shell: true }
);

process.exit(result.status ?? 1);
