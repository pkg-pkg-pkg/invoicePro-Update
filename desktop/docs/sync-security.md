# Sync Security & Access Control

Phase B implements authentication, role-based access control (RBAC), and audit trails for the sync layer.

## 1. Authentication Layer

### Token-Based Auth
All sync requests include authentication headers:
- `X-Sync-Token`: Session token
- `X-Sync-User`: User ID
- `X-Sync-Company`: Company/tenant ID

### Secure Storage
- Tokens stored via `storageDriver` (IndexedDB), NOT localStorage
- Encoded with base64 + URI encoding
- Session includes expiry timestamp (24h default)
- Refresh token support for session renewal

### Session Management
```typescript
// Create session after login
await syncAuth.createSession({ id, username, role, companyId });

// Validate token
const session = await syncAuth.validateToken(token);

// Refresh before expiry
await syncAuth.refreshSession();

// Clear on logout
await syncAuth.clearSession();
```

### Endpoint Protection
- Push engine: Attaches auth headers to `/api/sync/push`
- Pull engine: Attaches auth headers to `/api/sync/pull`
- Server should validate `X-Sync-Token` and reject 401 if invalid

## 2. Role-Based Access Control (RBAC)

### Roles
| Role | Description |
|------|-------------|
| `admin` | Full access to all features |
| `manager` | CRUD on masters, vouchers, reports, sync, audit view |
| `accountant` | View masters, create vouchers, reports, sync |
| `user` | View masters, create vouchers, view reports, sync |
| `viewer` | Read-only access, pull sync only |

### Permissions
| Permission | Admin | Manager | Accountant | User | Viewer |
|------------|-------|---------|------------|------|--------|
| `masters:create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `masters:update` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `masters:delete` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `masters:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `vouchers:create` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `vouchers:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `vouchers:delete` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reports:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reports:export` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `sync:push` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `sync:pull` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `audit:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `settings:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |

### Usage
```typescript
import { rbac } from '../services/auth/rbac';

// Check permission
if (!rbac.canCreateMaster()) {
  throw new Error('Permission denied');
}

// Assert permission (throws if denied)
rbac.assertPermission('vouchers:create', 'Create voucher');

// Get current user info
const userId = rbac.getCurrentUserId();
const role = rbac.getCurrentRole();
```

### Sync Enforcement
- Push engine checks `sync:push` permission before processing queue
- Pull engine checks `sync:pull` permission before fetching changes
- Viewers can only pull (read-only sync)

## 3. Audit Trail

### Captured Data
Every operation logs:
- `id`: Unique audit entry ID
- `userId`: Who performed the action
- `username`: Human-readable identifier
- `role`: User's role at time of action
- `companyId`: Tenant context
- `timestamp`: ISO timestamp
- `operation`: CREATE | UPDATE | DELETE | VIEW | SYNC_PUSH | SYNC_PULL | LOGIN | LOGOUT
- `entityType`: What was affected (e.g., `ledger_accounts`)
- `entityId`: Specific record ID
- `details`: Optional context (e.g., changed fields)
- `userAgent`: Browser/client info

### Storage
- Stored in IndexedDB via `storageDriver`
- Key: `pve_audit_log`
- Auto-trimmed to last 10,000 entries
- Indexed by timestamp for efficient queries

### Sync Behavior
- Audit entries for sync operations auto-captured
- `SYNC_PUSH` logged on successful push
- `SYNC_PULL` logged on successful apply
- Append-only (no edits/deletes to audit log)

### Querying
```typescript
import { auditService } from '../services/audit/auditService';

// Get recent activity
const recent = await auditService.getRecentActivity(50);

// Filter by criteria
const filtered = await auditService.getLog({
  userId: 'user-123',
  entityType: 'vouchers',
  operation: 'CREATE',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
  limit: 100,
});
```

## 4. Security Best Practices

### Token Handling
- Never store tokens in localStorage (XSS vulnerable)
- Use storageDriver (IndexedDB) for secure persistence
- Validate token expiry before each request
- Clear session on logout

### Request Security
- All sync requests include auth headers
- Server must validate token + user + company
- Reject requests with expired/invalid tokens (401)
- Log failed auth attempts

### Tenant Isolation
- `companyId` included in all sync payloads
- Server must filter data by company scope
- Cross-tenant data access blocked

### Replay Protection
- Event IDs are unique (generated via `generateId`)
- Server should track processed event IDs
- Reject duplicate event IDs (idempotency)

## 5. Event Codes

### Auth Events
| Code | Meaning |
|------|---------|
| `SYNC_PUSH_PERMISSION_DENIED` | User lacks `sync:push` permission |
| `SYNC_PULL_PERMISSION_DENIED` | User lacks `sync:pull` permission |
| `AUDIT_ENTRY` | Audit log recorded |

## 6. Verification Scenarios

### Auth Validation
1. Login creates sync session with valid token
2. Push/pull requests include auth headers
3. Expired tokens rejected (session cleared)
4. Logout clears session completely

### RBAC Enforcement
1. Admin can push/pull/CRUD all entities
2. Viewer can only pull (push blocked)
3. User cannot delete masters or vouchers
4. Permission denied logged with clear code

### Audit Trail
1. Every CREATE/UPDATE/DELETE logged
2. Sync operations logged (SYNC_PUSH/SYNC_PULL)
3. Login/logout tracked
4. Audit log queryable by filters
5. Audit entries include userId, timestamp, operation, entity

---

This security layer ensures production-grade access control comparable to mature accounting systems like TallyPrime.
