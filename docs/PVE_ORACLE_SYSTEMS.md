# PVE Systems — Oracle ADB Architecture

Two **completely independent** systems on **PVEDATABASE** (India South / Hyderabad).

| System | Folder | Schema | Port | Purpose |
|--------|--------|--------|------|---------|
| **2 — Invoice Pro** | `invoicepro-api/` | `INVOICEPRO` | 3001 | Desktop delta sync + mobile mirror |
| **3 — Standalone Mobile** | `mobile-standalone-api/` | `MOBILE` | 3002 | Full cloud accounting, no desktop |

Shared utilities only: `pve-utils/` (UUID, date formatting).

## Oracle wallet setup

1. Download Instance Wallet from OCI console (India South).
2. Extract to `Oracle/wallet/` (unzip `Wallet_PVEDATABASE.zip`).
3. Create schema users `INVOICEPRO` and `MOBILE` in ADB console.
4. Run SQL scripts:
   - `invoicepro-api/sql/01_invoicepro_schema.sql` → as INVOICEPRO user
   - `mobile-standalone-api/sql/01_mobile_schema.sql` → as MOBILE user
   - `mobile-standalone-api/sql/02_mobile_rls.sql` → as MOBILE user

## Environment variables

```env
ORACLE_WALLET_PATH=./Oracle/wallet
ORACLE_DSN=pvedatabase_high
ORACLE_USER_INVOICEPRO=invoicepro_user
ORACLE_PASS_INVOICEPRO=***
ORACLE_USER_MOBILE=mobile_user
ORACLE_PASS_MOBILE=***
JWT_SECRET=***
```

## Running locally

```bash
# Build shared utils
cd pve-utils && npm install && npm run build

# System 2 — Invoice Pro middleware
cd invoicepro-api && cp .env.example .env && npm install && npm run dev

# System 3 — Standalone mobile API
cd mobile-standalone-api && cp .env.example .env && npm install && npm run dev
```

## Desktop integration (System 2)

The existing desktop app (`desktop/`) stores all data locally. Cloud sync is **opt-in**:

- Settings → **Mobile Cloud Sync (Middleware)**
- On every save/edit, deltas queue locally and push to `POST /api/sync/push`
- Offline changes flush automatically when connection returns

The legacy embedded mobile middleware (`desktop/electron/mobileSyncMiddleware.js`) remains for LAN/desktop-tethered mode. The new `invoicepro-api` is the cloud path (Tally + BizAnalyst model).

## Data isolation rules

- No shared tables between INVOICEPRO and MOBILE schemas
- Every API query filters by `user_id`
- MOBILE schema uses VPD + JWT `parent_user_id` for child users
- INVOICEPRO child edits go to `child_pending` until parent approves

## Child billing (both systems)

₹699 per child per year — tracked in `child_subscriptions`. Payment gateway is out of scope; subscription rows are created on child creation/renewal.

## Not in scope

- PVEAPI / WhatsApp / Tally integration
- Admin panel
- Payment gateway
- Existing `backend/` (PostgreSQL) — legacy; not used by these systems
