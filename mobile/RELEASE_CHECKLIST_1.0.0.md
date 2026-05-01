# Mobile 1.0.0 Release Checklist

## Build And Version
- Verify `mobile/package.json` version is `1.0.0`.
- Run `npm install` in `mobile`.
- Build Android debug and release variants.
- Confirm app opens without crash on fresh install.

## Authentication
- Mobile login works via `/api/mobile/auth/login`.
- Token persists after app restart.
- Logout clears local session and returns to login screen.

## Create-Only Policy Validation
- Mobile can create:
  - Customer/Supplier ledgers
  - Payment/Receipt entries
  - Sales/Purchase invoices
- Mobile cannot update/delete protected records (expect `403` policy message).
- Mobile cannot trigger blocked actions like cancel/reconcile/stock adjust.

## Functional Smoke Tests
- Party search works in:
  - `Parties`
  - `Entries`
  - `Bills`
- Multi-item invoice row add/remove works in `Bills`.
- Bill preview totals (subtotal, GST, grand total) are correct.
- Payment/Receipt create updates backend successfully.

## Sync And Data Safety
- New records created on mobile visible on desktop.
- No cross-company data leakage with different users/companies.
- Duplicate create from retry does not produce inconsistent totals.

## Production Readiness
- Backend `.env` is set and API reachable from device.
- SMTP/feedback route tested from app (optional but recommended).
- Known issues documented before release tag.
- Git branch pushed and PR prepared for release merge.

