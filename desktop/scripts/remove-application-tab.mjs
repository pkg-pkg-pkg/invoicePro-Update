import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/Settings.tsx');
let lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');

const start = lines.findIndex((l) => l.includes("activeSection === 'application'"));
if (start < 0) {
  console.log('Application block not found');
  process.exit(0);
}

let end = start;
let depth = 0;
for (let i = start; i < lines.length; i++) {
  if (lines[i].includes('{activeSection ===')) depth++;
  if (lines[i].trim() === ')}') {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}

lines = lines.slice(0, start).concat(lines.slice(end + 1));
fs.writeFileSync(file, lines.join('\r\n'));
console.log(`Removed application tab (lines ${start + 1}-${end + 1})`);
