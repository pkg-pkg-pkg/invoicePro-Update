# Module 10: Data Model (ERD) & System Flow

## Table of Contents

1. [High-Level ERD Overview](#1-high-level-erd-overview)
2. [Core Entities (Tables)](#2-core-entities-tables)
3. [Relationships Summary](#3-relationships-summary)
4. [System Flows (Step-by-step)](#4-system-flows-step-by-step)
5. [Indexing & Performance Guidelines](#5-indexing--performance-guidelines)
6. [Naming & Consistency Rules](#6-naming--consistency-rules)

---

## 1. High-Level ERD Overview

### Main Domains

#### Master Data
- **companies** - Company/tenant information
- **branches** - Multi-branch support (future enhancement)
- **users** - User accounts and authentication
- **categories** - Product categories (hierarchical)
- **products** - Product master data
- **customers** - Customer master data
- **suppliers** - Supplier master data
- **bank_accounts** - Bank account management

#### Transactions
- **invoices** - Sales and purchase invoices, credit/debit notes
- **invoice_items** - Line items for invoices
- **payments** - Payment receipts and payments
- **expenses** - Expense tracking (to be implemented)
- **stock_movements** - Stock ledger/transaction history

#### GST & Accounting
- **GST Reports** - Generated on-the-fly from transaction data
  - GSTR-1 (B2B, B2C, HSN Summary)
  - GSTR-2 (Purchase data)
  - GSTR-3B (Monthly summary)
  - HSN Summary

#### System & Sync
- **sync_logs** - Sync operation tracking
- **devices** - Device registration (to be implemented)
- **user_activity_logs** - Audit trail (to be implemented)
- **settings** - System settings (to be implemented)

---

## 2. Core Entities (Tables)

### 2.1 companies

**Purpose:** Each license/company → one record

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `name` | text | Legal business name |
| `gstin` | text | Unique GSTIN |
| `pan` | text | PAN number |
| `addressLine1` | text | Primary address |
| `addressLine2` | text | Secondary address (nullable) |
| `city` | text | City |
| `state` | text | State |
| `pincode` | text | PIN code |
| `country` | text | Default: "India" |
| `phone` | text | Contact phone |
| `email` | text | Contact email (nullable) |
| `website` | text | Website URL (nullable) |
| `logo` | text | Logo URL (nullable) |
| `bankDetails` | json | Bank account details (nullable) |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- One-to-many: `users`, `products`, `categories`, `customers`, `suppliers`, `invoices`, `payments`, `bankAccounts`

**Indexes:**
- Primary key on `id`
- Unique index on `gstin`

---

### 2.2 branches (Future Enhancement)

**Purpose:** Multi-branch support under company

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `companyId` | uuid (FK) | Foreign key to companies |
| `name` | text | Branch name |
| `code` | text | Branch code |
| `addressLine1` | text | Branch address |
| `addressLine2` | text | Secondary address (nullable) |
| `city` | text | City |
| `state` | text | State |
| `pincode` | text | PIN code |
| `phone` | text | Contact phone |
| `isActive` | boolean | Active status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Note:** Currently not implemented. All transactions are company-level. Branch support can be added in Phase 2.

---

### 2.3 users

**Purpose:** User accounts and authentication

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `username` | text | Unique username |
| `email` | text | Unique email |
| `password` | text | Hashed password (bcrypt) |
| `fullName` | text | Full name |
| `role` | enum | ADMIN, MANAGER, SALESPERSON, ACCOUNTANT |
| `isActive` | boolean | Active status |
| `companyId` | uuid (FK) | Foreign key to companies (nullable) |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`

**Indexes:**
- Primary key on `id`
- Unique index on `username`
- Unique index on `email`
- Index on `companyId`

**Enums:**
- `UserRole`: ADMIN, MANAGER, SALESPERSON, ACCOUNTANT

---

### 2.4 categories (product_categories)

**Purpose:** Product categories with hierarchical support

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `name` | text | Category name |
| `parentId` | uuid (FK) | Foreign key to categories (nullable) - for hierarchy |
| `description` | text | Category description (nullable) |
| `companyId` | uuid (FK) | Foreign key to companies |
| `isActive` | boolean | Active status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`
- Self-referential: `parent` → `children` (hierarchical)

**Indexes:**
- Primary key on `id`
- Index on `companyId`
- Index on `parentId`

---

### 2.5 products

**Purpose:** Product master data

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `name` | text | Product name |
| `code` | text | SKU/Product code (unique per company) |
| `barcode` | text | Barcode (nullable) |
| `categoryId` | uuid (FK) | Foreign key to categories (nullable) |
| `hsnCode` | text | HSN code (nullable) |
| `sacCode` | text | SAC code (nullable) |
| `unit` | text | Unit of measurement (PCS, KG, LTR, etc.) |
| `uqc` | text | UQC code (nullable) |
| `purchasePrice` | decimal(18,2) | Purchase price |
| `salePrice` | decimal(18,2) | Sale price |
| `mrp` | decimal(18,2) | Maximum Retail Price (nullable) |
| `wholesalePrice` | decimal(18,2) | Wholesale price (nullable) |
| `distributorPrice` | decimal(18,2) | Distributor price (nullable) |
| `openingStock` | decimal(18,2) | Opening stock quantity |
| `currentStock` | decimal(18,2) | Current stock quantity |
| `lowStockAlert` | decimal(18,2) | Low stock alert threshold |
| `trackBatch` | boolean | Enable batch tracking |
| `trackSerial` | boolean | Enable serial number tracking |
| `trackExpiry` | boolean | Enable expiry date tracking |
| `images` | text[] | Array of image URLs |
| `companyId` | uuid (FK) | Foreign key to companies |
| `isActive` | boolean | Active status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`, `categories`
- One-to-many: `invoiceItems`, `stockMovements`

**Indexes:**
- Primary key on `id`
- Unique index on `[companyId, code]`
- Index on `companyId`
- Index on `categoryId`
- Index on `barcode`

---

### 2.6 customers (parties - customer type)

**Purpose:** Customer master data

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `name` | text | Customer name |
| `code` | text | Customer code (unique per company, nullable) |
| `gstin` | text | GSTIN (nullable) |
| `pan` | text | PAN (nullable) |
| `group` | enum | RETAIL, WHOLESALE, DISTRIBUTOR, VIP |
| `creditLimit` | decimal(18,2) | Credit limit |
| `creditDays` | int | Credit days |
| `addressLine1` | text | Billing address line 1 |
| `addressLine2` | text | Billing address line 2 (nullable) |
| `city` | text | City |
| `state` | text | State |
| `pincode` | text | PIN code |
| `country` | text | Country (default: "India") |
| `phone` | text | Phone number |
| `email` | text | Email (nullable) |
| `whatsapp` | text | WhatsApp number (nullable) |
| `photo` | text | Photo URL (nullable) |
| `openingBalance` | decimal(18,2) | Opening balance |
| `currentBalance` | decimal(18,2) | Current outstanding balance |
| `companyId` | uuid (FK) | Foreign key to companies |
| `isActive` | boolean | Active status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`
- One-to-many: `invoices` (where partyType = CUSTOMER), `payments`

**Indexes:**
- Primary key on `id`
- Unique index on `[companyId, code]`
- Index on `companyId`
- Index on `gstin`

**Enums:**
- `CustomerGroup`: RETAIL, WHOLESALE, DISTRIBUTOR, VIP

**Note:** For multiple addresses, consider adding an `Address` model (future enhancement).

---

### 2.7 suppliers (parties - supplier type)

**Purpose:** Supplier master data

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `name` | text | Supplier name |
| `code` | text | Supplier code (unique per company, nullable) |
| `gstin` | text | GSTIN (nullable) |
| `pan` | text | PAN (nullable) |
| `addressLine1` | text | Address line 1 |
| `addressLine2` | text | Address line 2 (nullable) |
| `city` | text | City |
| `state` | text | State |
| `pincode` | text | PIN code |
| `country` | text | Country (default: "India") |
| `phone` | text | Phone number |
| `email` | text | Email (nullable) |
| `whatsapp` | text | WhatsApp number (nullable) |
| `creditDays` | int | Credit days |
| `openingBalance` | decimal(18,2) | Opening balance |
| `currentBalance` | decimal(18,2) | Current payable balance |
| `companyId` | uuid (FK) | Foreign key to companies |
| `isActive` | boolean | Active status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`
- One-to-many: `invoices` (where partyType = SUPPLIER), `payments`

**Indexes:**
- Primary key on `id`
- Unique index on `[companyId, code]`
- Index on `companyId`
- Index on `gstin`

---

### 2.8 invoices (sales_invoices + purchase_invoices)

**Purpose:** Sales and purchase invoices, credit/debit notes

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `invoiceNumber` | text | Invoice number (unique per company) |
| `type` | enum | SALES_INVOICE, SALES_RETURN, PURCHASE_INVOICE, PURCHASE_RETURN, CREDIT_NOTE, DEBIT_NOTE, PROFORMA, QUOTATION, DELIVERY_CHALLAN, PURCHASE_ORDER, SALES_ORDER |
| `date` | timestamp | Invoice date |
| `partyId` | text | Customer/Supplier ID (references customers.id or suppliers.id) |
| `partyType` | enum | CUSTOMER or SUPPLIER |
| `subtotal` | decimal(18,2) | Subtotal before discount |
| `discount` | decimal(18,2) | Discount amount |
| `discountType` | enum | PERCENTAGE or FIXED |
| `additionalCharges` | json | Additional charges (shipping, etc.) |
| `roundOff` | decimal(18,2) | Round off amount |
| `totalAmount` | decimal(18,2) | Total amount (subtotal - discount) |
| `cgst` | decimal(18,2) | CGST amount |
| `sgst` | decimal(18,2) | SGST amount |
| `igst` | decimal(18,2) | IGST amount |
| `totalTax` | decimal(18,2) | Total tax amount |
| `grandTotal` | decimal(18,2) | Grand total (totalAmount + totalTax + roundOff) |
| `paymentStatus` | enum | PENDING, PARTIAL, PAID, OVERDUE |
| `paymentMode` | text[] | Array of payment modes |
| `notes` | text | Notes (nullable) |
| `terms` | text | Terms and conditions (nullable) |
| `ewayBillNumber` | text | E-way bill number (nullable) |
| `isCancelled` | boolean | Cancelled status |
| `cancelledAt` | timestamp | Cancellation timestamp (nullable) |
| `cancelledBy` | text | User who cancelled (nullable) |
| `companyId` | uuid (FK) | Foreign key to companies |
| `createdBy` | text | User ID who created |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`
- One-to-many: `invoiceItems`, `payments`

**Indexes:**
- Primary key on `id`
- Unique index on `[companyId, invoiceNumber]`
- Index on `companyId`
- Index on `partyId`
- Index on `date`
- Index on `type`

**Enums:**
- `InvoiceType`: SALES_INVOICE, SALES_RETURN, PURCHASE_INVOICE, PURCHASE_RETURN, CREDIT_NOTE, DEBIT_NOTE, PROFORMA, QUOTATION, DELIVERY_CHALLAN, PURCHASE_ORDER, SALES_ORDER
- `PartyType`: CUSTOMER, SUPPLIER
- `DiscountType`: PERCENTAGE, FIXED
- `PaymentStatus`: PENDING, PARTIAL, PAID, OVERDUE

**Note:** For sync, consider adding `localUpdatedAt` and `sourceDeviceId` fields (future enhancement).

---

### 2.9 invoice_items (sales_invoice_items + purchase_invoice_items)

**Purpose:** Line items for invoices

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `invoiceId` | uuid (FK) | Foreign key to invoices |
| `productId` | uuid (FK) | Foreign key to products (nullable) |
| `name` | text | Product name (for non-product items) |
| `hsnCode` | text | HSN code (nullable) |
| `sacCode` | text | SAC code (nullable) |
| `quantity` | decimal(18,2) | Quantity |
| `unit` | text | Unit of measurement |
| `rate` | decimal(18,2) | Rate per unit |
| `discount` | decimal(18,2) | Discount amount |
| `discountType` | enum | PERCENTAGE or FIXED |
| `taxableAmount` | decimal(18,2) | Taxable amount (quantity × rate - discount) |
| `gstRate` | decimal(18,2) | GST rate percentage |
| `cgst` | decimal(18,2) | CGST amount |
| `sgst` | decimal(18,2) | SGST amount |
| `igst` | decimal(18,2) | IGST amount |
| `totalTax` | decimal(18,2) | Total tax amount |
| `totalAmount` | decimal(18,2) | Total amount (taxableAmount + totalTax) |
| `batchNumber` | text | Batch number (nullable) |
| `serialNumber` | text | Serial number (nullable) |
| `createdAt` | timestamp | Creation timestamp |

**Relationships:**
- Many-to-one: `invoices`, `products`

**Indexes:**
- Primary key on `id`
- Index on `invoiceId`
- Index on `productId`

**Enums:**
- `DiscountType`: PERCENTAGE, FIXED

---

### 2.10 payments

**Purpose:** Payment receipts and payments

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `type` | enum | RECEIPT (from customer) or PAYMENT (to supplier) |
| `partyId` | text | Customer/Supplier ID |
| `partyType` | enum | CUSTOMER or SUPPLIER |
| `amount` | decimal(18,2) | Payment amount |
| `paymentMode` | enum | CASH, CARD, UPI, CHEQUE, NEFT, RTGS, IMPS, BANK_TRANSFER |
| `referenceNumber` | text | Reference number (nullable) |
| `chequeNumber` | text | Cheque number (nullable) |
| `chequeDate` | timestamp | Cheque date (nullable) |
| `bankId` | uuid (FK) | Foreign key to bank_accounts (nullable) |
| `invoiceId` | uuid (FK) | Foreign key to invoices (nullable) |
| `notes` | text | Notes (nullable) |
| `date` | timestamp | Payment date |
| `companyId` | uuid (FK) | Foreign key to companies |
| `createdBy` | text | User ID who created |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`, `bankAccounts`, `invoices`

**Indexes:**
- Primary key on `id`
- Index on `companyId`
- Index on `partyId`
- Index on `date`
- Index on `type`

**Enums:**
- `PaymentType`: RECEIPT, PAYMENT
- `PartyType`: CUSTOMER, SUPPLIER
- `PaymentMode`: CASH, CARD, UPI, CHEQUE, NEFT, RTGS, IMPS, BANK_TRANSFER

**Note:** For multiple invoice adjustments, consider adding `appliedInvoices` JSON field (future enhancement).

---

### 2.11 bank_accounts

**Purpose:** Bank account management

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `name` | text | Account name/alias |
| `accountNumber` | text | Account number |
| `ifscCode` | text | IFSC code |
| `bankName` | text | Bank name |
| `branchName` | text | Branch name (nullable) |
| `accountType` | enum | SAVINGS, CURRENT, CASH |
| `openingBalance` | decimal(18,2) | Opening balance |
| `currentBalance` | decimal(18,2) | Current balance |
| `companyId` | uuid (FK) | Foreign key to companies |
| `isActive` | boolean | Active status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`
- One-to-many: `payments`

**Indexes:**
- Primary key on `id`
- Index on `companyId`

**Enums:**
- `BankAccountType`: SAVINGS, CURRENT, CASH

---

### 2.12 stock_movements (stock_ledger)

**Purpose:** Stock transaction ledger - heart of inventory

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `productId` | uuid (FK) | Foreign key to products |
| `type` | enum | OPENING, PURCHASE, SALE, RETURN, ADJUSTMENT, TRANSFER |
| `quantity` | decimal(18,2) | Quantity (positive for IN, negative for OUT) |
| `rate` | decimal(18,2) | Rate per unit |
| `batchNumber` | text | Batch number (nullable) |
| `serialNumber` | text | Serial number (nullable) |
| `expiryDate` | timestamp | Expiry date (nullable) |
| `manufacturingDate` | timestamp | Manufacturing date (nullable) |
| `referenceId` | text | Reference ID (invoice ID, etc.) |
| `referenceType` | text | Reference type (INVOICE, ADJUSTMENT, etc.) |
| `notes` | text | Notes (nullable) |
| `createdAt` | timestamp | Creation timestamp |
| `createdBy` | text | User ID who created |

**Relationships:**
- Many-to-one: `products`

**Indexes:**
- Primary key on `id`
- Index on `productId`
- Index on `type`
- Index on `createdAt`

**Enums:**
- `StockMovementType`: OPENING, PURCHASE, SALE, RETURN, ADJUSTMENT, TRANSFER

**Note:** Balance quantity is calculated on-the-fly or stored in `products.currentStock`.

---

### 2.13 expenses (To be implemented)

**Purpose:** Expense tracking

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `category` | text | Expense category |
| `amount` | decimal(18,2) | Expense amount |
| `date` | timestamp | Expense date |
| `paymentMode` | text | Payment mode |
| `referenceNumber` | text | Reference number (nullable) |
| `bankId` | uuid (FK) | Foreign key to bank_accounts (nullable) |
| `remarks` | text | Remarks (nullable) |
| `attachment` | text | Attachment URL (nullable) |
| `companyId` | uuid (FK) | Foreign key to companies |
| `createdBy` | text | User ID who created |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`, `bankAccounts`

---

### 2.14 sync_logs

**Purpose:** Sync operation tracking

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `deviceId` | text | Device unique identifier |
| `entity` | text | Entity type (products, invoices, etc.) |
| `action` | text | Action (create, update, delete) |
| `data` | json | Entity data |
| `timestamp` | timestamp | Local timestamp |
| `syncedAt` | timestamp | Server sync timestamp (nullable) |
| `companyId` | text | Company ID |
| `userId` | text | User ID |

**Relationships:**
- None (standalone log table)

**Indexes:**
- Primary key on `id`
- Index on `deviceId`
- Index on `companyId`
- Index on `timestamp`

---

### 2.15 devices (To be implemented)

**Purpose:** Device registration for sync

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `companyId` | uuid (FK) | Foreign key to companies |
| `type` | enum | DESKTOP, MOBILE, WEB |
| `deviceName` | text | Device name |
| `deviceId` | text | Unique device identifier |
| `lastSyncAt` | timestamp | Last sync timestamp |
| `appVersion` | text | App version |
| `isActive` | boolean | Active status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

**Relationships:**
- Many-to-one: `companies`

**Enums:**
- `DeviceType`: DESKTOP, MOBILE, WEB

---

### 2.16 user_activity_logs (To be implemented)

**Purpose:** Audit trail for user actions

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Primary key |
| `companyId` | uuid (FK) | Foreign key to companies |
| `userId` | uuid (FK) | Foreign key to users |
| `action` | text | Action performed |
| `module` | text | Module name |
| `referenceId` | text | Reference entity ID (nullable) |
| `description` | text | Action description |
| `ipAddress` | text | IP address (nullable) |
| `createdAt` | timestamp | Creation timestamp |

**Relationships:**
- Many-to-one: `companies`, `users`

**Indexes:**
- Primary key on `id`
- Index on `companyId`
- Index on `userId`
- Index on `createdAt`

---

## 3. Relationships Summary

### ERD Diagram (Text Format)

```
companies
   ├── users (one-to-many)
   ├── categories (one-to-many)
   │   └── products (one-to-many)
   │       ├── invoice_items (one-to-many)
   │       └── stock_movements (one-to-many)
   ├── customers (one-to-many)
   │   ├── invoices (one-to-many, where partyType = CUSTOMER)
   │   └── payments (one-to-many)
   ├── suppliers (one-to-many)
   │   ├── invoices (one-to-many, where partyType = SUPPLIER)
   │   └── payments (one-to-many)
   ├── invoices (one-to-many)
   │   ├── invoice_items (one-to-many)
   │   └── payments (one-to-many)
   ├── payments (one-to-many)
   ├── bank_accounts (one-to-many)
   │   └── payments (one-to-many)
   └── sync_logs (one-to-many)

categories
   └── categories (self-referential, parent-child hierarchy)
```

### Relationship Details

| Parent Entity | Child Entity | Relationship Type | Foreign Key |
|---------------|--------------|-------------------|-------------|
| `companies` | `users` | One-to-Many | `users.companyId` |
| `companies` | `categories` | One-to-Many | `categories.companyId` |
| `companies` | `products` | One-to-Many | `products.companyId` |
| `companies` | `customers` | One-to-Many | `customers.companyId` |
| `companies` | `suppliers` | One-to-Many | `suppliers.companyId` |
| `companies` | `invoices` | One-to-Many | `invoices.companyId` |
| `companies` | `payments` | One-to-Many | `payments.companyId` |
| `companies` | `bank_accounts` | One-to-Many | `bank_accounts.companyId` |
| `categories` | `products` | One-to-Many | `products.categoryId` |
| `categories` | `categories` | Self-referential | `categories.parentId` |
| `products` | `invoice_items` | One-to-Many | `invoice_items.productId` |
| `products` | `stock_movements` | One-to-Many | `stock_movements.productId` |
| `customers` | `invoices` | One-to-Many | `invoices.partyId` (where partyType = CUSTOMER) |
| `customers` | `payments` | One-to-Many | `payments.partyId` (where partyType = CUSTOMER) |
| `suppliers` | `invoices` | One-to-Many | `invoices.partyId` (where partyType = SUPPLIER) |
| `suppliers` | `payments` | One-to-Many | `payments.partyId` (where partyType = SUPPLIER) |
| `invoices` | `invoice_items` | One-to-Many | `invoice_items.invoiceId` |
| `invoices` | `payments` | One-to-Many | `payments.invoiceId` |
| `bank_accounts` | `payments` | One-to-Many | `payments.bankId` |

---

## 4. System Flows (Step-by-step)

### 4.1 Flow – Create Sales Invoice (Desktop/Mobile)

**Step 1: User opens New Sale screen**
- App loads from local SQLite:
  - Products (active only)
  - Customers (active only)
  - Tax rates (from configuration)

**Step 2: User selects customer**
- Load customer details:
  - Name, GSTIN, address
  - Credit limit and current balance
  - Outstanding invoices (if any)

**Step 3: User adds items**
- For each item:
  - Select product (or enter manually)
  - Enter quantity
  - System auto-fills: rate, HSN code, GST rate
  - Calculate line total: `(quantity × rate) - discount`
  - Calculate tax: `line_total × (gst_rate / 100)`
  - Split tax into CGST/SGST or IGST based on place of supply

**Step 4: Apply invoice-level discount (optional)**
- Enter discount amount or percentage
- Recalculate all line items if percentage-based

**Step 5: Calculate invoice totals**
- Subtotal = sum of all line taxable amounts
- Total discount = sum of line discounts + invoice discount
- Taxable amount = subtotal - total discount
- Total tax = sum of all line taxes
- Round off = round(grand_total) - grand_total
- Grand total = taxable amount + total tax + round off

**Step 6: On Save (Local)**
- Generate invoice number (format: INV-001, auto-increment)
- Create record in `invoices` table:
  - Set `type` = SALES_INVOICE
  - Set `partyType` = CUSTOMER
  - Set `paymentStatus` = PENDING (if no payment)
  - Set `isCancelled` = false
- Insert rows into `invoice_items` table (one per line item)
- Insert rows into `stock_movements` table:
  - `type` = SALE
  - `quantity` = negative (out)
  - `referenceId` = invoice.id
  - `referenceType` = "INVOICE"
- Update `products.currentStock` (decrease by quantity)
- Update `customers.currentBalance` (increase by grand_total)
- Mark `localUpdatedAt` = now() and `synced` = false

**Step 7: If payment received**
- Create record in `payments` table:
  - `type` = RECEIPT
  - `partyType` = CUSTOMER
  - `amount` = payment amount
  - `invoiceId` = invoice.id
- Update `invoices`:
  - `receivedAmount` += payment amount
  - `balanceAmount` = grand_total - received_amount
  - `paymentStatus` = PAID (if balance = 0) or PARTIAL
- Update `customers.currentBalance` (decrease by payment amount)
- If bank payment: Update `bank_accounts.currentBalance` (increase)

**Step 8: Print/Share invoice**
- Generate PDF or share via WhatsApp/Email

**Step 9: During next sync**
- Upload `invoices`, `invoice_items`, `stock_movements`, `payments` to server
- Server validates and stores
- Client marks records as synced

---

### 4.2 Flow – Purchase Invoice

**Step 1: User opens New Purchase screen**
- Load suppliers and products from local SQLite

**Step 2: User selects supplier**
- Load supplier details and credit terms

**Step 3: User adds items**
- Select products or enter manually
- Enter quantity and rate
- System calculates line totals and taxes

**Step 4: Calculate invoice totals**
- Same as sales invoice calculation

**Step 5: On Save (Local)**
- Create record in `invoices` table:
  - `type` = PURCHASE_INVOICE
  - `partyType` = SUPPLIER
- Insert `invoice_items`
- Insert `stock_movements`:
  - `type` = PURCHASE
  - `quantity` = positive (in)
- Update `products.currentStock` (increase)
- Update `products.purchasePrice` (optional: update latest purchase price)
- Update `suppliers.currentBalance` (increase by grand_total)

**Step 6: If payment made**
- Create `payments` record:
  - `type` = PAYMENT
  - `partyType` = SUPPLIER
- Update `suppliers.currentBalance` (decrease)
- Update `bank_accounts.currentBalance` (decrease if bank payment)

---

### 4.3 Flow – Payment Collection (Customer)

**Step 1: User opens Payment Collection screen**
- Select customer
- Display:
  - Current outstanding balance
  - List of unpaid/partial invoices

**Step 2: User enters payment details**
- Amount
- Payment mode (CASH, UPI, CHEQUE, etc.)
- Reference number (if applicable)
- Bank account (if bank payment)
- Date

**Step 3: User selects invoices to adjust (optional)**
- Select one or more invoices
- System auto-calculates allocation:
  - If amount = sum of invoice balances → mark invoices as PAID
  - If amount < sum → mark as PARTIAL
  - If amount > sum → store excess as advance

**Step 4: On Save**
- Create record in `payments`:
  - `type` = RECEIPT
  - `partyType` = CUSTOMER
  - `amount` = payment amount
  - `invoiceId` = selected invoice (if single) or null (if multiple)
  - Store `appliedInvoices` as JSON array (if multiple)
- Update `invoices`:
  - For each applied invoice:
    - `receivedAmount` += allocated amount
    - `balanceAmount` = grand_total - received_amount
    - `paymentStatus` = PAID (if balance = 0) or PARTIAL
- Update `customers.currentBalance` (decrease by payment amount)
- Update `bank_accounts.currentBalance` (increase if bank payment)

---

### 4.4 Flow – Stock Ledger

**Every transaction that impacts stock MUST:**

**Step 1: Identify transaction type**
- OPENING: Opening stock entry
- PURCHASE: Purchase invoice
- SALE: Sales invoice
- RETURN: Sales/Purchase return
- ADJUSTMENT: Manual stock adjustment
- TRANSFER: Stock transfer between branches

**Step 2: Create stock_movements entry**
- `productId` = product ID
- `type` = transaction type
- `quantity` = positive (IN) or negative (OUT)
- `rate` = rate per unit
- `referenceId` = source transaction ID
- `referenceType` = "INVOICE", "ADJUSTMENT", etc.
- `batchNumber`, `serialNumber`, `expiryDate` (if applicable)

**Step 3: Recalculate balance**
- Query all `stock_movements` for product
- Calculate: `balance_qty = opening_stock + sum(qty_in) - sum(qty_out)`
- Update `products.currentStock` = balance_qty

**Step 4: For batch/serial tracking**
- Maintain separate balance per batch/serial number
- Validate availability before sale

**Stock Movement Types:**
- **OPENING**: `quantity` = positive, initial stock
- **PURCHASE**: `quantity` = positive, from purchase invoice
- **SALE**: `quantity` = negative, from sales invoice
- **RETURN**: `quantity` = positive (sales return) or negative (purchase return)
- **ADJUSTMENT**: `quantity` = positive (increase) or negative (decrease)
- **TRANSFER**: `quantity` = negative (source branch) or positive (destination branch)

---

### 4.5 Flow – GST Report Generation (e.g., GSTR-1)

**Step 1: User selects period**
- From date: Month start (e.g., 2024-12-01)
- To date: Month end (e.g., 2024-12-31)

**Step 2: Query sales invoices**
- Filter: `type` = SALES_INVOICE, `date` between from and to, `isCancelled` = false
- Include `invoice_items` and `customers`

**Step 3: Categorize invoices**

**B2B (Business-to-Business):**
- Customer has GSTIN
- Invoice is taxable (not exempt)
- Group by customer GSTIN

**B2C Large:**
- Customer has no GSTIN
- Invoice value > ₹2,50,000
- Group by invoice

**B2C Small:**
- Customer has no GSTIN
- Invoice value ≤ ₹2,50,000
- Group by tax rate

**Step 4: Process each invoice**
- For each `invoice_item`:
  - Extract: HSN code, quantity, rate, taxable value, tax rates
  - Calculate: CGST, SGST, IGST based on place of supply
  - Place of supply = customer.state (if same as company.state → CGST/SGST, else → IGST)

**Step 5: Generate HSN Summary**
- Group by HSN code
- Sum: quantity, taxable value, CGST, SGST, IGST

**Step 6: Format for GST Portal**
- Convert to JSON schema as per GSTN portal requirements
- Include: CTIN (customer GSTIN), invoice number, date, value, tax details

**Step 7: Export**
- Excel format (for review)
- JSON format (for GST portal upload)

**GSTR-1 Sections:**
1. **B2B**: All B2B invoices with customer GSTIN
2. **B2C Large**: Invoices > ₹2,50,000 without GSTIN
3. **B2C Small**: Invoices ≤ ₹2,50,000 without GSTIN
4. **Credit/Debit Notes**: Linked to original invoice
5. **HSN Summary**: HSN-wise summary

---

### 4.6 Flow – Sync (Desktop/Mobile ↔ Cloud)

**Assumption:** Each record has `updatedAt` (server) and `localUpdatedAt` (client) for change tracking.

#### UPLOAD (Client → Server)

**Step 1: Client identifies unsynced records**
- Query all tables where `localUpdatedAt > lastSyncAt` OR `synced = false`
- Group by entity type: products, customers, invoices, payments, etc.

**Step 2: Prepare payload**
```json
{
  "deviceId": "device-uuid",
  "lastSyncTime": "2024-12-06T09:00:00Z",
  "changes": {
    "products": [
      {
        "id": "local-uuid",
        "action": "create",
        "data": { ... },
        "timestamp": "2024-12-06T10:00:00Z"
      }
    ],
    "invoices": [ ... ],
    "payments": [ ... ]
  }
}
```

**Step 3: Call POST /sync/upload**
- Send payload to server
- Include JWT token in Authorization header

**Step 4: Server processes**
- For each entity in `changes`:
  - **If action = "create":**
    - Check if UUID exists (conflict)
    - If exists: Compare timestamps, apply conflict resolution
    - If not: Insert as new
  - **If action = "update":**
    - Fetch existing record
    - Compare `updatedAt` (server) vs `localUpdatedAt` (client)
    - If client newer: Update
    - If server newer: Return conflict
  - **If action = "delete":**
    - Soft delete (set `isActive` = false or `deletedAt` = now())

**Step 5: Server responds**
```json
{
  "success": true,
  "results": {
    "created": [ { "entityType": "products", "localId": "...", "serverId": "..." } ],
    "updated": [ ... ],
    "conflicts": [ ... ]
  },
  "syncedAt": "2024-12-06T12:00:00Z"
}
```

**Step 6: Client updates local records**
- For created: Update local UUID → server UUID mapping
- For updated: Update `localUpdatedAt` = `syncedAt`
- For conflicts: Store conflict data for manual resolution
- Update `lastSyncAt` = `syncedAt`

#### DOWNLOAD (Server → Client)

**Step 1: Client calls GET /sync/download**
- Query: `?lastSyncTime=2024-12-06T09:00:00Z&deviceId=device-uuid`

**Step 2: Server queries updates**
- For each table:
  - Return records where `updatedAt > lastSyncTime`
  - Filter by `companyId` (from JWT token)

**Step 3: Server responds**
```json
{
  "success": true,
  "lastSyncTime": "2024-12-06T12:00:00Z",
  "updates": {
    "products": [ ... ],
    "customers": [ ... ],
    "invoices": [ ... ]
  },
  "conflicts": [ ... ]
}
```

**Step 4: Client processes updates**
- For each record in `updates`:
  - **If exists locally:**
    - Compare `updatedAt` (server) vs `localUpdatedAt` (client)
    - If server newer: Update local record
    - If client newer: Store conflict
  - **If not exists:**
    - Insert as new

**Step 5: Client resolves conflicts**
- Display conflicts to user
- User chooses: Keep local, Use server, or Merge
- Call POST /sync/resolve-conflict with resolution

**Step 6: Update sync status**
- Update `lastSyncAt` = server `lastSyncTime`
- Mark records as synced

---

### 4.7 Flow – Dashboard Calculations

**Dashboard widgets pull from:**

#### Today's Sales
```sql
SELECT SUM(grand_total) 
FROM invoices 
WHERE company_id = ? 
  AND type = 'SALES_INVOICE' 
  AND DATE(date) = CURRENT_DATE 
  AND is_cancelled = false;
```

#### Today's Purchase
```sql
SELECT SUM(grand_total) 
FROM invoices 
WHERE company_id = ? 
  AND type = 'PURCHASE_INVOICE' 
  AND DATE(date) = CURRENT_DATE 
  AND is_cancelled = false;
```

#### Cash in Hand
```sql
-- Opening cash (from bank_accounts where account_type = 'CASH')
-- + Cash receipts (from payments where mode = 'CASH' and type = 'RECEIPT')
-- - Cash payments (from payments where mode = 'CASH' and type = 'PAYMENT')
-- - Cash expenses (from expenses where payment_mode = 'CASH')
```

#### Outstanding Receivable
```sql
SELECT SUM(current_balance) 
FROM customers 
WHERE company_id = ? 
  AND is_active = true 
  AND current_balance > 0;
```

#### Outstanding Payable
```sql
SELECT SUM(current_balance) 
FROM suppliers 
WHERE company_id = ? 
  AND is_active = true 
  AND current_balance > 0;
```

#### Top 10 Customers
```sql
SELECT 
  c.id,
  c.name,
  COUNT(i.id) as invoice_count,
  SUM(i.grand_total) as total_sales
FROM customers c
LEFT JOIN invoices i ON i.party_id = c.id AND i.party_type = 'CUSTOMER'
WHERE c.company_id = ?
  AND i.date >= ? -- period start
  AND i.date <= ? -- period end
  AND i.is_cancelled = false
GROUP BY c.id, c.name
ORDER BY total_sales DESC
LIMIT 10;
```

#### Top 10 Products
```sql
SELECT 
  p.id,
  p.name,
  SUM(ii.quantity) as total_quantity,
  SUM(ii.total_amount) as total_sales
FROM products p
LEFT JOIN invoice_items ii ON ii.product_id = p.id
LEFT JOIN invoices i ON i.id = ii.invoice_id
WHERE p.company_id = ?
  AND i.type = 'SALES_INVOICE'
  AND i.date >= ? -- period start
  AND i.date <= ? -- period end
  AND i.is_cancelled = false
GROUP BY p.id, p.name
ORDER BY total_sales DESC
LIMIT 10;
```

---

## 5. Indexing & Performance Guidelines

### 5.1 Critical Indexes

**For Performance:**
```sql
-- Invoices
CREATE INDEX idx_invoices_company_date ON invoices(company_id, date);
CREATE INDEX idx_invoices_company_type ON invoices(company_id, type);
CREATE INDEX idx_invoices_party ON invoices(party_id, party_type);

-- Invoice Items
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Products
CREATE INDEX idx_products_company_name ON products(company_id, name);
CREATE INDEX idx_products_company_code ON products(company_id, code);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Customers/Suppliers
CREATE INDEX idx_customers_company_name ON customers(company_id, name);
CREATE INDEX idx_suppliers_company_name ON suppliers(company_id, name);
CREATE INDEX idx_customers_gstin ON customers(gstin) WHERE gstin IS NOT NULL;

-- Payments
CREATE INDEX idx_payments_party_date ON payments(party_id, date);
CREATE INDEX idx_payments_company_date ON payments(company_id, date);

-- Stock Movements
CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, created_at);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);

-- Sync Logs
CREATE INDEX idx_sync_logs_device_timestamp ON sync_logs(device_id, timestamp);
CREATE INDEX idx_sync_logs_company ON sync_logs(company_id);
```

### 5.2 Query Optimization

**Best Practices:**
1. **Always filter by `companyId`** first (most selective)
2. **Use pagination** for list queries (limit 50-100 records)
3. **Avoid SELECT *** - select only required columns
4. **Use WHERE clauses** before JOINs
5. **Index foreign keys** and frequently queried columns
6. **Use EXPLAIN ANALYZE** to check query plans

**Example Optimized Query:**
```sql
-- ❌ Bad: Full table scan
SELECT * FROM invoices WHERE date > '2024-12-01';

-- ✅ Good: Uses index
SELECT id, invoice_number, date, grand_total 
FROM invoices 
WHERE company_id = ? 
  AND date >= '2024-12-01' 
  AND date <= '2024-12-31'
  AND is_cancelled = false
ORDER BY date DESC
LIMIT 50 OFFSET 0;
```

### 5.3 Pagination

**Standard Pagination:**
- Default page size: 50
- Maximum page size: 1000
- Use cursor-based pagination for large datasets (optional)

**Example:**
```sql
SELECT * FROM products 
WHERE company_id = ? 
ORDER BY name 
LIMIT 50 OFFSET ?;
```

### 5.4 Caching Strategy

**Cache frequently accessed data:**
- Product list (cache for 5 minutes)
- Customer/Supplier list (cache for 5 minutes)
- Dashboard summary (cache for 1 minute)
- GST reports (cache for 1 hour)

---

## 6. Naming & Consistency Rules

### 6.1 Table Naming

- Use **plural** nouns: `products`, `customers`, `invoices`
- Use **snake_case**: `invoice_items`, `stock_movements`
- Avoid abbreviations unless standard: `id`, `gstin`, `pan`

### 6.2 Column Naming

- **Primary keys**: `id` (uuid)
- **Foreign keys**: `<table>_id` (e.g., `product_id`, `company_id`)
- **Timestamps**: `created_at`, `updated_at`, `deleted_at`
- **Sync fields**: `local_updated_at`, `source_device_id`
- **Boolean flags**: `is_active`, `is_cancelled`, `is_synced`
- **Amounts**: Use descriptive names: `grand_total`, `taxable_amount`, `discount_amount`

### 6.3 Data Types

- **IDs**: `uuid` (PostgreSQL) or `text` (SQLite)
- **Monetary values**: `decimal(18,2)` (PostgreSQL) or `real` (SQLite)
- **Timestamps**: `timestamp` or `datetime`
- **Text**: `text` or `varchar(n)` for limited length
- **Booleans**: `boolean`
- **JSON**: `json` or `jsonb` (PostgreSQL)

### 6.4 Soft Delete

**Standard Pattern:**
- Use `is_active` boolean flag (default: `true`)
- OR use `deleted_at` timestamp (nullable)
- Always filter: `WHERE is_active = true` or `WHERE deleted_at IS NULL`

### 6.5 Timestamps

**Standard Fields:**
- `created_at`: Set on insert (default: `now()`)
- `updated_at`: Auto-update on modify
- `deleted_at`: Set on soft delete (nullable)
- `local_updated_at`: Client-side timestamp for sync (nullable)

### 6.6 Enums

**Naming:**
- Use **UPPER_SNAKE_CASE**: `SALES_INVOICE`, `PAYMENT_STATUS`
- Group related enums: `InvoiceType`, `PaymentStatus`, `StockMovementType`

### 6.7 Constraints

**Standard Constraints:**
- **Primary Key**: Always `id` (uuid)
- **Unique**: `[company_id, code]` for codes (products, customers, etc.)
- **Foreign Keys**: Always indexed
- **NOT NULL**: Required fields (name, company_id, etc.)
- **DEFAULT**: Use defaults for common values (`is_active = true`, `opening_balance = 0`)

---

## Summary

This Data Model (ERD) & System Flow document provides:

✅ **Complete entity definitions** with all columns and types  
✅ **Relationship mapping** between all tables  
✅ **Step-by-step system flows** for key business processes  
✅ **Performance guidelines** with indexing recommendations  
✅ **Naming conventions** for consistency  
✅ **Query optimization** best practices  

This document, along with the API Documentation (Module 9) and Technical Architecture (Module 8), provides a complete specification for developers to implement the GST Billing Software.

---

**Next Steps:**
1. Review and align with existing Prisma schema
2. Implement missing tables (expenses, devices, user_activity_logs)
3. Add branch support (if required)
4. Implement sync engine with conflict resolution
5. Add comprehensive indexes for performance
6. Create database migration scripts

