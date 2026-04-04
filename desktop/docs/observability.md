# Observability & Diagnostics

Phase A hardening introduces structured logging, metrics, and diagnostics across the sync and posting subsystems. Use this guide to interpret logs/metrics and troubleshoot issues quickly.

## 1. Structured Logging

All logs are emitted via `systemLogger` with consistent payloads:

```
{
  ts: ISO timestamp,
  subsystem: 'sync' | 'posting',
  event: string,
  code: string,
  message: string,
  ...context
}
```

### Sync Event Codes
| Code | Meaning |
|------|---------|
| `SYNC_ENQUEUE` | Event added to queue.
| `SYNC_CAPTURE_REQUEST` | Storage layer requested capture.
| `SYNC_QUEUE_PENDING` | Queue sweep started.
| `SYNC_MARK_SYNCING` / `SYNC_MARK_SYNCED` | Event state change.
| `SYNC_RETRY_SCHEDULED` | Retry scheduled with backoff.
| `SYNC_PUSH_ATTEMPT` | Outbound attempt started.
| `SYNC_PUSH_SUCCESS` | Push succeeded.
| `SYNC_PUSH_FAILURE` | Push failed (see `error`).
| `SYNC_PUSH_OFFLINE` | Push skipped (offline).
| `SYNC_PUSH_LOOP_ERROR` / `SYNC_PUSH_INITIAL_ERROR` | Loop failures.
| `SYNC_PUSH_ONLINE_TRIGGER` | Browser online → manual push.
| `SYNC_PULL_FETCH_START` | Pull started.
| `SYNC_PULL_FETCH_SUCCESS` | Pull succeeded; includes `fetched` count.
| `SYNC_PULL_APPLY_BATCH` | Applying fetched entries.
| `SYNC_PULL_APPLY_SUCCESS` | Specific change applied.
| `SYNC_PULL_APPLY_ERROR` | Apply failure for an entity.
| `SYNC_PULL_FAILURE` | Pull cycle failure.
| `SYNC_PULL_OFFLINE` | Pull skipped (offline).
| `SYNC_PULL_LOOP_ERROR` / `SYNC_PULL_INITIAL_ERROR` | Loop failures.
| `SYNC_PULL_ONLINE_TRIGGER` | Browser online → manual pull.
| `SYNC_PULL_CURSOR_UPDATE` | Cursor advanced after pull.
| `SYNC_PULL_CREATE_EXISTS` / `SYNC_PULL_UPDATE_STALE` etc. | Conflict skips (see metrics below).

### Posting Event Codes
| Code | Meaning |
|------|---------|
| `POST_LINE_LEDGER_MISSING`, `POST_INVALID_AMOUNT`, ... | Validation failures per line (voucher rejected).
| `POST_UNBALANCED` | Debit/Credit mismatch.
| `POST_CASHBANK_*` | Cash/bank-specific validation failures.
| `POST_LEDGER_INACTIVE` | Resolved ledger inactive.
| `POST_SUCCESS` | Voucher posted successfully.

## 2. Metrics (syncMetrics)

`syncMetrics.getSnapshot()` exposes:

- `pending`, `synced`, `failed`: queue distribution.
- `lastEnqueueAt`: most recent enqueue timestamp.
- `lastPushAttemptAt` / `lastPushAt` / `lastPushError`: outbound status.
- `lastPullAttemptAt` / `lastPullAt` / `lastPullError`: inbound status.
- `lastCursor`: last cursor persisted from host.
- `lastPullFetched`: number of changes retrieved last pull.
- `retryCount`, `lastRetryAt`: retry behavior.
- `lastConflict`: last conflict reason + timestamp.

### Interpreting Metrics
- **Stuck push**: `pending` > 0 with `lastPushError` set → check last `SYNC_PUSH_FAILURE` log.
- **Pull conflicts**: `lastConflict` points to the entity/reason; inspect `conflict_skip` logs.
- **Offline backlog**: `pending` growing while `lastPushAttemptAt` is stale → device likely offline.

## 3. Diagnostics API

`syncService.getDiagnostics()` returns:

```
{
  metrics: SyncMetricsSnapshot,
  queueDepth: number,
  queueSample: SyncEvent[] // last 5 entries
}
```

Use in dev tools or scripts to inspect sync health without UI changes. Example:

```ts
const diag = await syncService.getDiagnostics();
console.table(diag.metrics);
console.table(diag.queueSample.map(({ id, entityType, status }) => ({ id, entityType, status })));
```

## 4. Debugging Workflow

1. **Check metrics** via `syncService.getDiagnostics()`.
2. **Filter logs** (DevTools console) by subsystem:
   - `subsystem === 'sync'` for push/pull lifecycle.
   - `subsystem === 'posting'` for voucher validations.
3. **Locate error code** (e.g., `SYNC_PUSH_FAILURE`).
4. **Resolve root cause**:
   - Network/auth issues → fix host connectivity.
   - Conflict codes (`SYNC_PULL_*`) → inspect incoming payload vs local state.
   - Posting codes (`POST_*`) → correct voucher data.
5. **Verify recovery**: ensure `pending` drains to 0 and `lastPushError` clears.

This instrumentation mirrors mature accounting systems: structured logs, stable codes, and quick answers to “what synced, what failed, and why?”
