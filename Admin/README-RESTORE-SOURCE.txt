This folder had a full Vite + React admin app under `src/`. Those sources are missing on disk (empty `src`).

Restore steps:
1. Copy your backed-up `Admin/src` (and root `electron.js`, `preload.js` if used) back into this folder, or
2. Re-clone / copy from the machine or drive where you last built the Admin .exe.

After restore, run from `Admin/` folder:
  npm install
  npm run build
