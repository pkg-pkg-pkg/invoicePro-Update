# Data Model Quick Reference Guide

## Table Index

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `companies` | Company/tenant data | id, name, gstin, pan |
| `users` | User accounts | id, username, email, role, companyId |
| `categories` | Product categories | id, name, parentId, companyId |
| `products` | Product master | id, name, code, currentStock, companyId |
| `customers` | Customer master | id, name, gstin, currentBalance, companyId |
| `suppliers` | Supplier master | id, name, gstin, currentBalance, companyId |
| `invoices` | Sales/Purchase invoices | id, invoiceNumber, type, partyId, grandTotal |
| `invoice_items` | Invoice line items | id, invoiceId, productId, quantity, rate |
| `payments` | Payment receipts/payments | id, type, partyId, amount, paymentMode |
| `bank_accounts` | Bank accounts | id, name, accountNumber, currentBalance |
| `stock_movements` | Stock ledger | id, productId, type, quantity, rate |

## Common Queries

### Get Products with Low Stock
```sql
SELECT * FROM products 
WHERE company_id = ? 
  AND current_stock <= low_stock_alert 
  AND is_active = true;
```

### Get Customer Outstanding
```sql
SELECT * FROM customers 
WHERE company_id = ? 
  AND current_balance > 0 
  AND is_active = true
ORDER BY current_balance DESC;
```

### Get Today's Sales
```sql
SELECT SUM(grand_total) as total_sales
FROM invoices 
WHERE company_id = ? 
  AND type = 'SALES_INVOICE' 
  AND DATE(date) = CURRENT_DATE 
  AND is_cancelled = false;
```

### Get Invoice with Items
```sql
SELECT i.*, ii.* 
FROM invoices i
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.id = ? AND i.company_id = ?;
```

## Field Naming Conventions

- **IDs**: `id` (uuid)
- **Foreign Keys**: `<table>_id` (e.g., `product_id`, `company_id`)
- **Timestamps**: `created_at`, `updated_at`, `deleted_at`
- **Booleans**: `is_<property>` (e.g., `is_active`, `is_cancelled`)
- **Amounts**: `<description>_amount` or `<description>_total` (e.g., `grand_total`, `taxable_amount`)

## Common Enums

### InvoiceType
- `SALES_INVOICE`, `PURCHASE_INVOICE`, `SALES_RETURN`, `PURCHASE_RETURN`, `CREDIT_NOTE`, `DEBIT_NOTE`

### PaymentStatus
- `PENDING`, `PARTIAL`, `PAID`, `OVERDUE`

### PaymentMode
- `CASH`, `CARD`, `UPI`, `CHEQUE`, `NEFT`, `RTGS`, `IMPS`, `BANK_TRANSFER`

### StockMovementType
- `OPENING`, `PURCHASE`, `SALE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`

## Relationships Quick Look

```
companies
  ├── users
  ├── products → invoice_items
  ├── customers → invoices → invoice_items
  ├── suppliers → invoices → invoice_items
  ├── invoices → payments
  └── bank_accounts → payments
```

## Sync Fields

- `updated_at`: Server-side timestamp
- `local_updated_at`: Client-side timestamp (for sync)
- `source_device_id`: Device that created the record

## Performance Tips

1. **Always filter by `company_id` first**
2. **Use indexes on foreign keys**
3. **Pagination: Limit 50, Max 1000**
4. **Avoid SELECT ***
5. **Use WHERE before JOINs**

## See Also

- Full documentation: `docs/DATA_MODEL_ERD.md`
- API documentation: `docs/API_DOCUMENTATION.md`
- Technical architecture: `docs/TECHNICAL_ARCHITECTURE.md`

