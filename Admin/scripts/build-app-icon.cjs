/**
 * Builds a multi-size Windows .ico from src/assets/INV.png for Electron / NSIS.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = typeof pngToIcoMod === 'function' ? pngToIcoMod : pngToIcoMod.default;

const root = path.join(__dirname, '..');
const input = path.join(root, 'src', 'assets', 'INV.png');
const outIco = path.join(root, 'electron', 'icon.ico');
const outPng = path.join(root, 'electron', 'icon.png');

async function buildFromPng(source) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(
    sizes.map((s) =>
      sharp(source)
        .resize(s, s, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer(),
    ),
  );
  return pngToIco(buffers);
}

async function main() {
  if (!fs.existsSync(input)) {
    console.error('build-app-icon: missing', input);
    process.exit(1);
  }

  const ico = await buildFromPng(input);
  fs.mkdirSync(path.dirname(outIco), { recursive: true });
  fs.writeFileSync(outIco, ico);
  fs.copyFileSync(input, outPng);

  console.log('build-app-icon: wrote', outIco);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
