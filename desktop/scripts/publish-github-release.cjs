/**
 * Upload desktop/releases/* artifacts to a GitHub Release (no package.json repository edit).
 *
 * Required env:
 *   GH_TOKEN          — classic PAT with `repo` scope
 *   GITHUB_OWNER      — e.g. myuser
 *   GITHUB_REPO       — e.g. gst-billing-desktop
 *
 * Optional:
 *   GITHUB_TAG        — default: v{version from package.json}
 *   DRAFT             — set to "1" for draft release
 *
 * Run after: npm run dist
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const releasesDir = path.join(root, 'releases');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(pkg.version || '0.0.0').trim();

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const tag = (process.env.GITHUB_TAG || `v${version}`).trim();
const draft = process.env.DRAFT === '1';

function req(method, urlPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'invoicepro-desktop-publish',
        Authorization: `Bearer ${token}`,
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { raw };
        }
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          const err = new Error(`GitHub ${res.statusCode}: ${raw.slice(0, 500)}`);
          err.statusCode = res.statusCode;
          err.body = raw;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (bodyObj) req.write(JSON.stringify(bodyObj));
    req.end();
  });
}

function uploadAsset(release, filePath, name) {
  const buf = fs.readFileSync(filePath);
  const base = String(release.upload_url || '').split('{')[0];
  const url = new URL(base);
  url.searchParams.set('name', name);

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'invoicepro-desktop-publish',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': buf.length,
      },
    };
    const r = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(raw || '{}'));
        } else {
          reject(new Error(`Upload ${name} ${res.statusCode}: ${raw.slice(0, 300)}`));
        }
      });
    });
    r.on('error', reject);
    r.write(buf);
    r.end();
  });
}

async function main() {
  if (!token) {
    console.error('Set GH_TOKEN (or GITHUB_TOKEN).');
    process.exit(1);
  }
  if (!owner || !repo) {
    console.error('Set GITHUB_OWNER and GITHUB_REPO (e.g. GITHUB_OWNER=you GITHUB_REPO=gst-billing-desktop).');
    process.exit(1);
  }
  if (!fs.existsSync(releasesDir)) {
    console.error('Missing releases/ — run npm run dist first.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(releasesDir)
    .filter((f) => f.endsWith('.exe') || f.endsWith('.yml') || f.endsWith('.yaml') || f.endsWith('.blockmap'))
    .map((f) => path.join(releasesDir, f))
    .filter((p) => fs.statSync(p).isFile());

  if (!files.length) {
    console.error('No .exe / .yml / .blockmap in releases/. Run npm run dist.');
    process.exit(1);
  }

  const body = {
    tag_name: tag,
    name: `GST Billing Software ${version}`,
    body: `Desktop build ${version}\n\nIncludes NSIS installer, portable exe, latest.yml for auto-update.`,
    draft,
    generate_release_notes: false,
  };

  let release;
  try {
    release = await req('POST', `/repos/${owner}/${repo}/releases`, body);
  } catch (e) {
    const bodyStr = String(e.body || '');
    const duplicateRelease =
      e.statusCode === 422 &&
      (bodyStr.includes('already_exists') ||
        /Release.*already exists|tag_name.*already/i.test(bodyStr));

    if (duplicateRelease) {
      console.log('Release already exists for this tag; fetching...');
      release = await req(
        'GET',
        `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`
      );
    } else {
      console.error(e.message);
      if (e.statusCode === 422) {
        console.error(
          'Hint: if the repo is empty, push at least one commit (e.g. README) on the default branch, then retry.'
        );
      }
      if (e.statusCode === 404) {
        console.error(
          'Hint: check GITHUB_OWNER / GITHUB_REPO and that the token has repo access.'
        );
      }
      process.exit(1);
    }
  }

  if (!release.upload_url) {
    console.error('No upload_url on release response:', release);
    process.exit(1);
  }

  for (const fp of files) {
    const name = path.basename(fp);
    console.log('Uploading', name, '...');
    await uploadAsset(release, fp, name);
  }

  console.log('Done. Release:', release.html_url || `https://github.com/${owner}/${repo}/releases/tag/${tag}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
