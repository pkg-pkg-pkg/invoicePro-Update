# Standalone Mobile API (System 3)

Full accounting REST API for the independent mobile app. Completely separate from Invoice Pro middleware.

- **Port:** 3002 (default)
- **Database:** PVEDATABASE / MOBILE schema
- **Auth:** JWT with OTP registration
- **Isolation:** Row Level Security + `user_id` filter on every query

## Setup

1. Extract Oracle wallet to `Oracle/wallet/`.
2. Copy `.env.example` → `.env`.
3. Run `sql/01_mobile_schema.sql` then `sql/02_mobile_rls.sql` as MOBILE user.
4. `npm install && npm run dev`

## Child users

Parent creates children with per-module permissions (`none` | `read` | `add` | `add_edit` | `full`).
Each active child = ₹699/year. Expired subscription → read-only.

## Modules

`sales`, `purchase`, `ledger`, `receipts`, `items`, `customers`, `reports` — Company Settings always `none` for children.
