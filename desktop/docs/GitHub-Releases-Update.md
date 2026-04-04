# GitHub Releases + in-app auto-update (Electron)

The desktop app uses **electron-updater**. It reads **`latest.yml`** from GitHub Releases for the repo in **`package.json` → `repository.url`**.

## 1) One-time setup

1. Create a **public** GitHub repo (e.g. `gst-billing-updates`). It can contain only a README; source code is optional.
2. In **`desktop/package.json`**, set `repository.url` to that repo (replace placeholders):

   `"url": "https://github.com/<username>/<repo>.git"`

3. Create a **Personal Access Token** (classic): GitHub → **Settings → Developer settings → Personal access tokens**.  
   Scope: **`repo`** (needed to upload releases from CLI).

4. Before publishing a build, set the token in the environment (PowerShell):

   ```powershell
   $env:GH_TOKEN = "ghp_xxxxxxxx"
   ```

   (electron-builder also accepts `GITHUB_TOKEN`.)

## 2) Each new version

1. Bump **`desktop/package.json`** → **`version`** (e.g. `1.0.1`). This must be **higher** than what users already installed.
2. Build and publish artifacts to GitHub.

   **Option A — `electron-builder` publish** (needs correct `repository.url` in `package.json`):

   ```powershell
   cd desktop
   $env:GH_TOKEN = "ghp_xxxxxxxx"
   npm run dist:publish
   ```

   **Option B — build locally, then upload with script** (no `repository.url` edit; set owner/repo in env):

   ```powershell
   cd desktop
   npm run dist
   $env:GH_TOKEN = "ghp_xxxxxxxx"
   $env:GITHUB_OWNER = "your-github-username"
   $env:GITHUB_REPO = "your-release-repo"
   npm run release:github
   ```

   Tag defaults to **`v` + `version`** from `package.json` (e.g. `v1.0.0`). Override: `$env:GITHUB_TAG = "v1.0.1"`.

   Or build without upload, then attach files manually from **`desktop/releases/`** to a new GitHub Release with the **same tag** as `version` (e.g. `v1.0.1`).

3. **Required assets on the release** (from `releases/` after build):

   - **`latest.yml`**
   - **`GST Billing Software-Setup-<version>.exe`** (NSIS installer — name follows `electron-builder.json` `nsis.artifactName`)
   - Optional: **`.exe.blockmap`** (smaller delta downloads)

4. Tag the release as **`v` + version** (e.g. `v1.0.1`). electron-updater matches **published** releases and `latest.yml`.

## 3) User machine behaviour

- **NSIS installed** app: **Settings → About & Updates** → Check / Download / Install & Restart. A background check runs ~15s after startup; a **Windows notification** may appear if an update exists.
- **Portable `.exe`**: auto-update is **not** supported the same way; use the full installer for auto-updates.

## 4) Troubleshooting

- **No update found**: Wrong repo URL, version not bumped, release not **published**, or `latest.yml` / `.exe` missing from that release.
- **Private repo**: Public read of releases is required unless you add a token flow (not configured here).
- **403 / publish failed**: Set `GH_TOKEN` with `repo` scope.
