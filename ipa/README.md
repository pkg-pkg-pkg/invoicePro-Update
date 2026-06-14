# Invoice Pro Middleware API (System 2)

REST middleware for Desktop ↔ Mobile sync. Stores **delta records only** in Oracle ADB schema `INVOICEPRO`.

- **Port:** 3001 (default)
- **Database:** PVEDATABASE / INVOICEPRO schema
- **Auth:** JWT (mobile login by mobile number)

## Setup

1. Extract Oracle Instance Wallet to `Oracle/wallet/` (from `Wallet_PVEDATABASE.zip`).
2. Copy `.env.example` → `.env` and fill credentials.
3. Run schema: `sql/01_invoicepro_schema.sql` as INVOICEPRO user.
4. `npm install && npm run dev`

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sync/push` | Desktop pushes delta records |
| GET | `/api/sync/fetch` | Mobile fetches changes since `last_sync_at` |
| POST | `/api/sync/mobile-push` | Mobile pushes edits (child → pending queue) |
| POST | `/api/auth/login` | Mobile login |
| GET/POST/PUT | `/api/invoices` | Invoice CRUD |
| GET/POST/PUT | `/api/customers` | Customer CRUD |
| POST | `/api/children` | Parent creates child user (₹699/year) |
| GET | `/api/children/pending` | Parent reviews child changes |

## Conflict resolution

Last-write-wins by `updated_at`. Conflicts logged in `conflict_log`.
