## InvoicePro Admin (new)

This is a fresh Admin UI for the Firebase project `invoicepro-105ba`.

### Setup

1. Create `Admin/.env.local` with the same Firebase values used by the desktop app (`desktop/.env.local`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

2. Install and run:

```bash
cd Admin
npm install
npm run dev
```

### Permissions

After login, the app checks Firestore document `admins/{uid}`.
If it exists, the user is treated as an Admin.

**Desktop app login ≠ Admin panel.** Desktop only reads `users/{your-email}` and uses Cloud Functions for licenses. The Admin UI also lists `licenses`, `users`, and writes `app_config` — that requires `admins/{firebase-uid}`.

1. **Firestore rules** (fix “Missing or insufficient permissions” on admin check):
   ```bash
   cd desktop
   firebase deploy --only firestore:rules
   ```
   Rules must allow `get` on `admins/{uid}` for the signed-in user (see `desktop/firestore.rules`).

2. **Create your admin record** (pick one):
   - Firebase Console → Firestore → collection `admins` → document id = your **Firebase Auth UID** → field `email` = your login email.
   - Or from desktop (owner email in functions config): call Cloud Function `becomeAdmin` once while signed in.

3. **Same Firebase project** in `Admin/.env.local` as `desktop/.env.local` (`VITE_FIREBASE_PROJECT_ID`, etc.).

