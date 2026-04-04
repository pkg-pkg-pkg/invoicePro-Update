# Data Export Service

Phase C introduces a lightweight export layer focused on compliance and reporting use-cases without UI dependencies.

## Supported Formats

| Format | Description | Recommended Use |
|--------|-------------|-----------------|
| CSV    | Comma-separated text with optional header row | Quick spreadsheet imports, lightweight sharing |
| JSON   | Structured JSON array with indentation | API consumers, debugging, archival |
| XLSX   | Excel workbook generated via `exceljs` | Finance teams, multi-sheet workflows |

## Basic Usage

```ts
import { exportService } from '../services/export/exportService';

await exportService.export({
  scope: 'masters',
  entityType: 'ledger_accounts',
  format: 'csv',
  options: {
    fileName: 'ledger-accounts.csv',
    includeHeader: true,
  },
});

await exportService.export({
  scope: 'vouchers',
  entityType: 'vouchers',
  format: 'xlsx',
  options: {
    sheetName: 'Sales Vouchers',
  },
});

await exportService.export({
  scope: 'audit',
  entityType: 'audit_log',
  format: 'json',
  filters: {
    fromDate: '2025-01-01',
    toDate: '2025-01-31',
    operation: 'EXPORT',
  },
});
```

## Available Scopes & Entities

| Scope     | Entities                              |
|-----------|---------------------------------------|
| masters   | `ledger_groups`, `ledger_accounts`, `inventory_items`, `item_categories`, `units_of_measure`, `godowns` |
| vouchers  | `vouchers` (all voucher types)        |
| audit     | `audit_log` (supports filters)        |
| sync      | `queue` (sync queue snapshot)         |

> **Note**: All data is read directly from IndexedDB via the existing services, so exports respect the current local dataset and user scope.

## Permissions

- Only roles with `reports:export` may perform exports (Admin, Manager, Accountant).
- `exportService` enforces this automatically via `rbac.hasPermission('reports:export')`.
- Unauthorized roles (User, Viewer) will receive `Permission denied: reports:export` errors.
- Every export (success or failure) is logged through `auditService.logExport` with scope, entity, format, and record count.

## Error Handling

- Unsupported scopes/entities or formats throw descriptive errors.
- Failures capture the error message in the audit log for traceability.
- Consumers should check the returned `ExportResult.success` flag before assuming completion.

## Future Enhancements

Per requirements, encryption, scheduling, or export history are intentionally excluded for now and can be layered later once explicitly requested.
