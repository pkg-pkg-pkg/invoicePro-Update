/**
 * Builds a multi-size Windows .ico from the first available logo PNG, or keeps / generates a fallback.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = typeof pngToIcoMod === 'function' ? pngToIcoMod : pngToIcoMod.default;
if (typeof pngToIco !== 'function') {
  console.error('build-app-icon: png-to-ico export is not a function', pngToIcoMod);
  process.exit(1);
}

const root = path.join(__dirname, '..');
const outIco = path.join(root, 'electron', 'icon.ico');

function resolveInputPng() {
  const candidates = [
    path.join(root, 'public', 'SQLOGO.png'),
    path.join(root, 'public', 'InvoicePro LOGO.png'),
    path.join(root, 'public', 'invoicepro-logo.png'),
    path.join(root, 'dist', 'SQLOGO.png'),
    path.join(root, 'dist', 'invoicepro-logo.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

async function buildFromPng(input) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(
    sizes.map((s) =>
      sharp(input)
        .resize(s, s, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer()
    )
  );
  return pngToIco(buffers);
}

async function buildPlaceholderIco() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(
    sizes.map((s) =>
      sharp({
        create: {
          width: s,
          height: s,
          channels: 4,
          background: { r: 15, g: 80, b: 56, alpha: 1 },
        },
      })
        .png()
        .toBuffer()
    )
  );
  return pngToIco(buffers);
}

async function main() {
  const input = resolveInputPng();
  if (!input) {
    if (fs.existsSync(outIco)) {
      console.log('build-app-icon: no PNG in public/ — keeping existing', outIco);
      return;
    }
    console.warn('build-app-icon: no logo PNG — writing placeholder icon (add public/SQLOGO.png for branding)');
    const ico = await buildPlaceholderIco();
    fs.mkdirSync(path.dirname(outIco), { recursive: true });
    fs.writeFileSync(outIco, ico);
    console.log('build-app-icon: wrote placeholder', outIco);
    return;
  }

  const ico = await buildFromPng(input);
  fs.mkdirSync(path.dirname(outIco), { recursive: true });
  fs.writeFileSync(outIco, ico);
  console.log('build-app-icon: wrote', outIco, 'from', path.relative(root, input));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
