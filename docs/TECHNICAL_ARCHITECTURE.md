# Technical Architecture Module - Complete Documentation

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Core Folders Structure](#2-core-folders-structure)
3. [Database Design](#3-database-design)
4. [API Layer Design](#4-api-layer-design)
5. [Sync Engine Logic](#5-sync-engine-logic)
6. [Coding Standards](#6-coding-standards)
7. [Testing Requirements](#7-testing-requirements)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. System Architecture

### 1.1 Offline-First Architecture

```
┌─────────────────────────────────┐
│   Desktop App (Windows)         │
│   Electron + React + SQLite     │
│   Local DB: better-sqlite3      │
└──────────────┬──────────────────┘
               │
               │ Offline + Local Cache
               │
┌──────────────▼──────────────────┐
│   Mobile App (Android)           │
│   React Native + SQLite         │
│   Local DB: react-native-sqlite  │
└──────────────┬──────────────────┘
               │
               │ Online Sync via REST/WebSockets
               │
┌──────────────▼──────────────────┐
│   Cloud Server                   │
│   Node.js + Express + PostgreSQL │
│   Redis (Cache + Sync Queue)     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│   Admin Dashboard / Backup       │
│   Analytics / Reporting          │
└─────────────────────────────────┘
```

### 1.2 Architecture Principles

#### Local First → Cloud Second
- All operations work offline
- Data stored in local SQLite first
- Sync to cloud when online
- No dependency on internet for core operations

#### Incremental Sync (Delta-based)
- Only sync changed data
- Track last sync timestamp
- Minimize data transfer
- Efficient bandwidth usage

#### Conflict Resolution: Last Update Wins
- Compare `updatedAt` timestamps
- Most recent change takes precedence
- Manual override option for critical conflicts
- Conflict log for audit trail

#### UUID-based Primary Keys
- Globally unique identifiers
- No ID conflicts across devices
- Enables offline record creation
- Format: `550e8400-e29b-41d4-a716-446655440000`

#### Soft-Delete + Timestamping
- Records marked as deleted, not removed
- `deletedAt` timestamp for sync tracking
- `isActive` flag for quick filtering
- Maintains referential integrity

#### Timestamp Fields
- `createdAt`: Record creation time
- `updatedAt`: Last modification time
- `deletedAt`: Deletion time (if soft-deleted)
- `syncedAt`: Last successful sync time

---

## 2. Core Folders Structure

### 2.1 Backend (Node.js)

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.ts      # DB connection config
│   │   ├── env.ts           # Environment variables
│   │   └── constants.ts     # App constants
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts          # JWT authentication
│   │   ├── errorHandler.ts  # Error handling
│   │   ├── validator.ts     # Request validation
│   │   └── logger.ts        # Request logging
│   │
│   ├── modules/             # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.types.ts
│   │   │
│   │   ├── product/
│   │   │   ├── product.controller.ts
│   │   │   ├── product.service.ts
│   │   │   ├── product.routes.ts
│   │   │   └── product.types.ts
│   │   │
│   │   ├── inventory/
│   │   │   ├── stock.controller.ts
│   │   │   ├── stock.service.ts
│   │   │   └── stock.routes.ts
│   │   │
│   │   ├── billing/
│   │   │   ├── invoice.controller.ts
│   │   │   ├── invoice.service.ts
│   │   │   └── invoice.routes.ts
│   │   │
│   │   ├── party/
│   │   │   ├── customer.controller.ts
│   │   │   ├── supplier.controller.ts
│   │   │   └── party.service.ts
│   │   │
│   │   ├── gst/
│   │   │   ├── gst.controller.ts
│   │   │   ├── gst.service.ts
│   │   │   └── gst.routes.ts
│   │   │
│   │   ├── reports/
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   └── reports.routes.ts
│   │   │
│   │   └── sync/
│   │       ├── sync.controller.ts
│   │       ├── sync.service.ts
│   │       ├── sync.routes.ts
│   │       └── conflict.resolver.ts
│   │
│   ├── utils/               # Utility functions
│   │   ├── logger.ts
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   └── helpers.ts
│   │
│   ├── jobs/                # Background jobs
│   │   ├── sync.job.ts      # Scheduled sync
│   │   ├── backup.job.ts    # Database backup
│   │   └── cleanup.job.ts   # Data cleanup
│   │
│   ├── database/            # Database utilities
│   │   ├── migrations/      # Migration scripts
│   │   ├── seeds/           # Seed data
│   │   └── prisma/           # Prisma schema
│   │
│   └── index.ts             # Application entry point
│
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── prisma/
│   └── schema.prisma        # Database schema
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### 2.2 Desktop App (Electron + React)

```
desktop/
├── app/
│   ├── renderer/            # React UI (main process)
│   │   ├── src/
│   │   │   ├── components/  # Reusable components
│   │   │   ├── pages/       # Page components
│   │   │   ├── store/       # Redux store
│   │   │   ├── services/    # API services
│   │   │   ├── utils/       # Utilities
│   │   │   └── hooks/       # Custom hooks
│   │   │
│   │   └── public/
│   │
│   ├── main/                # Electron main process
│   │   ├── main.ts          # Main entry
│   │   ├── preload.ts       # Preload script
│   │   └── window.ts        # Window management
│   │
│   ├── database/            # SQLite database
│   │   ├── db.ts            # Database connection
│   │   ├── migrations/      # Local migrations
│   │   └── models/         # Data models
│   │
│   ├── services/            # Business logic
│   │   ├── sync.service.ts  # Sync logic
│   │   ├── offline.service.ts
│   │   └── cache.service.ts
│   │
│   └── printing/             # Print functionality
│       ├── invoice.print.ts
│       └── report.print.ts
│
├── electron/
│   ├── main.ts
│   └── preload.ts
│
├── tests/
├── build/                    # Build output
├── dist/                     # Distribution files
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 2.3 Mobile App (React Native)

```
mobile/
├── lib/
│   ├── screens/             # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── ProductsScreen.tsx
│   │   └── InvoicesScreen.tsx
│   │
│   ├── widgets/             # Reusable widgets
│   │   ├── ProductCard.tsx
│   │   ├── InvoiceCard.tsx
│   │   └── PaymentCard.tsx
│   │
│   ├── services/            # Business services
│   │   ├── api.service.ts
│   │   ├── sync.service.ts
│   │   └── offline.service.ts
│   │
│   ├── database/            # SQLite database
│   │   ├── db.ts
│   │   ├── models/
│   │   └── migrations/
│   │
│   ├── sync/                # Sync engine
│   │   ├── sync.manager.ts
│   │   ├── conflict.resolver.ts
│   │   └── queue.manager.ts
│   │
│   ├── navigation/          # Navigation setup
│   │   └── AppNavigator.tsx
│   │
│   ├── store/               # Redux store
│   │   ├── index.ts
│   │   └── slices/
│   │
│   └── utils/               # Utilities
│
├── android/                 # Android native code
├── ios/                     # iOS native code (future)
├── tests/
├── package.json
└── tsconfig.json
```

---

## 3. Database Design

### 3.1 Primary Key Strategy

**All tables use UUID as primary key:**
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**Benefits:**
- Globally unique across all devices
- No ID conflicts during offline creation
- Enables distributed systems
- No need for auto-increment sequences

### 3.2 Timestamp Fields

**Standard fields in all tables:**
```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
deleted_at TIMESTAMP NULL
synced_at TIMESTAMP NULL
```

### 3.3 Soft Delete Pattern

**All tables support soft delete:**
```sql
is_active BOOLEAN DEFAULT true
deleted_at TIMESTAMP NULL
```

**Query pattern:**
```sql
SELECT * FROM products 
WHERE is_active = true 
AND deleted_at IS NULL
```

### 3.4 Complete Schema Documentation

#### 3.4.1 PRODUCT TABLE

```sql
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    category_id UUID REFERENCES categories(category_id),
    brand TEXT,
    hsn_code TEXT,
    sac_code TEXT,
    uqc TEXT,
    unit TEXT NOT NULL,
    mrp DECIMAL(15,2),
    sale_price DECIMAL(15,2) NOT NULL,
    purchase_price DECIMAL(15,2) NOT NULL,
    wholesale_price DECIMAL(15,2),
    distributor_price DECIMAL(15,2),
    min_stock DECIMAL(10,2) DEFAULT 0,
    low_stock_alert DECIMAL(10,2) DEFAULT 0,
    opening_stock DECIMAL(10,2) DEFAULT 0,
    current_stock DECIMAL(10,2) DEFAULT 0,
    barcode TEXT,
    sku TEXT,
    images JSONB,
    track_batch BOOLEAN DEFAULT false,
    track_serial BOOLEAN DEFAULT false,
    track_expiry BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    company_id UUID NOT NULL REFERENCES companies(company_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    synced_at TIMESTAMP NULL,
    
    UNIQUE(company_id, code),
    INDEX idx_products_name (name),
    INDEX idx_products_barcode (barcode),
    INDEX idx_products_category (category_id),
    INDEX idx_products_company (company_id),
    INDEX idx_products_active (is_active, deleted_at)
);
```

#### 3.4.2 STOCK LEDGER TABLE

```sql
CREATE TABLE stock_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id),
    transaction_type ENUM(
        'OPENING',
        'PURCHASE',
        'SALE',
        'RETURN',
        'ADJUSTMENT',
        'TRANSFER'
    ) NOT NULL,
    qty_in DECIMAL(10,2) DEFAULT 0,
    qty_out DECIMAL(10,2) DEFAULT 0,
    balance_qty DECIMAL(10,2) NOT NULL,
    rate DECIMAL(15,2) NOT NULL,
    batch_number TEXT,
    serial_number TEXT,
    expiry_date DATE,
    manufacturing_date DATE,
    reference_id UUID,  -- invoice_id, adjustment_id, etc.
    reference_type TEXT, -- 'INVOICE', 'ADJUSTMENT', etc.
    notes TEXT,
    company_id UUID NOT NULL REFERENCES companies(company_id),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP NULL,
    
    INDEX idx_stock_product (product_id),
    INDEX idx_stock_type (transaction_type),
    INDEX idx_stock_date (created_at),
    INDEX idx_stock_reference (reference_id, reference_type)
);
```

#### 3.4.3 PARTY TABLE (Customers/Suppliers)

```sql
-- Customers Table
CREATE TABLE customers (
    party_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type ENUM('CUSTOMER') DEFAULT 'CUSTOMER',
    name TEXT NOT NULL,
    code TEXT,
    gstin TEXT,
    pan TEXT,
    group_type ENUM('RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'VIP') DEFAULT 'RETAIL',
    credit_limit DECIMAL(15,2) DEFAULT 0,
    credit_days INTEGER DEFAULT 0,
    mobile TEXT NOT NULL,
    email TEXT,
    whatsapp TEXT,
    billing_address JSONB NOT NULL,
    shipping_address JSONB,
    photo TEXT,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    company_id UUID NOT NULL REFERENCES companies(company_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    synced_at TIMESTAMP NULL,
    
    UNIQUE(company_id, code),
    INDEX idx_customers_name (name),
    INDEX idx_customers_gstin (gstin),
    INDEX idx_customers_mobile (mobile),
    INDEX idx_customers_company (company_id)
);

-- Suppliers Table (similar structure)
CREATE TABLE suppliers (
    party_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type ENUM('SUPPLIER') DEFAULT 'SUPPLIER',
    -- ... same fields as customers
);
```

#### 3.4.4 SALES INVOICE TABLE

```sql
CREATE TABLE invoices (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no TEXT NOT NULL,
    type ENUM(
        'SALES_INVOICE',
        'SALES_RETURN',
        'PURCHASE_INVOICE',
        'PURCHASE_RETURN',
        'CREDIT_NOTE',
        'DEBIT_NOTE'
    ) NOT NULL,
    date DATE NOT NULL,
    party_id UUID NOT NULL,  -- customer_id or supplier_id
    party_type ENUM('CUSTOMER', 'SUPPLIER') NOT NULL,
    taxable_amount DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    discount_type ENUM('PERCENTAGE', 'FIXED') DEFAULT 'PERCENTAGE',
    additional_charges JSONB,
    round_off DECIMAL(15,2) DEFAULT 0,
    cgst DECIMAL(15,2) DEFAULT 0,
    sgst DECIMAL(15,2) DEFAULT 0,
    igst DECIMAL(15,2) DEFAULT 0,
    total_tax DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    grand_total DECIMAL(15,2) NOT NULL,
    payment_status ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE') DEFAULT 'PENDING',
    payment_mode TEXT[],
    notes TEXT,
    terms TEXT,
    eway_bill_number TEXT,
    is_cancelled BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP NULL,
    cancelled_by UUID REFERENCES users(user_id),
    salesperson_id UUID REFERENCES users(user_id),
    company_id UUID NOT NULL REFERENCES companies(company_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    synced_at TIMESTAMP NULL,
    
    UNIQUE(company_id, invoice_no),
    INDEX idx_invoices_date (date),
    INDEX idx_invoices_party (party_id),
    INDEX idx_invoices_type (type),
    INDEX idx_invoices_status (payment_status),
    INDEX idx_invoices_company (company_id)
);
```

#### 3.4.5 SALES INVOICE ITEMS TABLE

```sql
CREATE TABLE invoice_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(product_id),
    name TEXT NOT NULL,
    hsn_code TEXT,
    sac_code TEXT,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,
    rate DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0,
    discount_type ENUM('PERCENTAGE', 'FIXED') DEFAULT 'PERCENTAGE',
    taxable_amount DECIMAL(15,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst DECIMAL(15,2) DEFAULT 0,
    sgst DECIMAL(15,2) DEFAULT 0,
    igst DECIMAL(15,2) DEFAULT 0,
    total_tax DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    batch_number TEXT,
    serial_number TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_items_invoice (invoice_id),
    INDEX idx_items_product (product_id)
);
```

#### 3.4.6 PAYMENTS TABLE

```sql
CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type ENUM('RECEIPT', 'PAYMENT') NOT NULL,
    party_id UUID NOT NULL,
    party_type ENUM('CUSTOMER', 'SUPPLIER') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    mode ENUM(
        'CASH',
        'CARD',
        'UPI',
        'CHEQUE',
        'NEFT',
        'RTGS',
        'IMPS',
        'BANK_TRANSFER'
    ) NOT NULL,
    reference_no TEXT,
    cheque_number TEXT,
    cheque_date DATE,
    bank_id UUID REFERENCES bank_accounts(bank_id),
    invoice_id UUID REFERENCES invoices(invoice_id),
    notes TEXT,
    date DATE NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(company_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    synced_at TIMESTAMP NULL,
    
    INDEX idx_payments_date (date),
    INDEX idx_payments_party (party_id),
    INDEX idx_payments_type (type),
    INDEX idx_payments_company (company_id)
);
```

#### 3.4.7 EXPENSE TABLE

```sql
CREATE TABLE expenses (
    expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL,
    payment_mode TEXT,
    bank_id UUID REFERENCES bank_accounts(bank_id),
    remarks TEXT,
    attachment TEXT,
    company_id UUID NOT NULL REFERENCES companies(company_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    synced_at TIMESTAMP NULL,
    
    INDEX idx_expenses_date (date),
    INDEX idx_expenses_category (category),
    INDEX idx_expenses_company (company_id)
);
```

#### 3.4.8 USER TABLE

```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role ENUM('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALESPERSON') DEFAULT 'SALESPERSON',
    permissions JSONB,  -- Custom permissions
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP NULL,
    company_id UUID REFERENCES companies(company_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_users_username (username),
    INDEX idx_users_email (email),
    INDEX idx_users_company (company_id)
);
```

### 3.5 Indexing Strategy

**Primary Indexes:**
- All primary keys (UUID)
- Foreign keys for joins
- `company_id` for multi-tenant isolation

**Performance Indexes:**
- Date fields for time-based queries
- Status fields for filtering
- Search fields (name, code, barcode)
- Composite indexes for common queries

**Example Composite Index:**
```sql
CREATE INDEX idx_invoices_company_date_status 
ON invoices(company_id, date, payment_status);
```

---

## 4. API Layer Design

### 4.1 Authentication APIs

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### 4.2 Product APIs

```
GET    /api/v1/products              # List with filters
GET    /api/v1/products/:id          # Get single
POST   /api/v1/products              # Create
PUT    /api/v1/products/:id          # Update
DELETE /api/v1/products/:id          # Soft delete
GET    /api/v1/products/barcode/:code # Find by barcode
GET    /api/v1/products/low-stock    # Low stock alert
POST   /api/v1/products/bulk-stock   # Bulk stock update
```

### 4.3 Party APIs

```
# Customers
GET    /api/v1/customers
GET    /api/v1/customers/:id
POST   /api/v1/customers
PUT    /api/v1/customers/:id
DELETE /api/v1/customers/:id
GET    /api/v1/customers/:id/ledger
GET    /api/v1/customers/outstanding
GET    /api/v1/customers/by-phone/:phone
GET    /api/v1/customers/by-gstin/:gstin

# Suppliers (same pattern)
GET    /api/v1/suppliers
...
```

### 4.4 Sales APIs

```
GET    /api/v1/invoices              # List invoices
GET    /api/v1/invoices/:id          # Get invoice
POST   /api/v1/invoices              # Create invoice
PUT    /api/v1/invoices/:id          # Update invoice
DELETE /api/v1/invoices/:id          # Cancel invoice
POST   /api/v1/invoices/:id/cancel   # Cancel with reason
GET    /api/v1/invoices/:id/print    # Print invoice
```

### 4.5 Sync APIs

```
POST   /api/v1/sync/upload           # Upload local changes
GET    /api/v1/sync/download         # Download cloud updates
GET    /api/v1/sync/status           # Get sync status
POST   /api/v1/sync/resolve-conflict # Resolve conflict
GET    /api/v1/sync/history          # Sync history
```

**Upload Payload:**
```json
{
  "deviceId": "device-uuid",
  "lastSyncTime": "2024-01-01T00:00:00Z",
  "changes": {
    "products": [
      {
        "id": "product-uuid",
        "action": "create|update|delete",
        "data": { ... },
        "timestamp": "2024-01-01T00:00:00Z"
      }
    ],
    "invoices": [ ... ],
    "payments": [ ... ]
  }
}
```

**Download Response:**
```json
{
  "lastSyncTime": "2024-01-01T00:00:00Z",
  "updates": {
    "products": [ ... ],
    "invoices": [ ... ],
    "payments": [ ... ]
  },
  "conflicts": [ ... ]
}
```

### 4.6 API Versioning

**Current:** `/api/v1/...`

**Future:** `/api/v2/...` (backward compatible)

### 4.7 Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

---

## 5. Sync Engine Logic

### 5.1 Sync Flow Diagram

```
┌─────────────────────────────────────┐
│  1. Local Change Detected           │
│     - Create/Update/Delete record   │
│     - Set synced = false            │
│     - Log in SyncLog                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Check Internet Connection       │
│     - If offline: Queue for later   │
│     - If online: Proceed to sync    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Push Local Changes               │
│     - Get all records with           │
│       synced = false                 │
│     - Batch upload to server         │
│     - Server validates & saves       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Pull Cloud Updates               │
│     - Request updates since          │
│       lastSyncTime                   │
│     - Receive delta changes          │
│     - Apply to local database        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. Conflict Detection               │
│     - Compare timestamps             │
│     - Identify conflicts             │
│     - Apply resolution strategy      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. Update Sync Status               │
│     - Mark records as synced         │
│     - Update lastSyncTime            │
│     - Clear sync queue               │
└─────────────────────────────────────┘
```

### 5.2 Conflict Resolution Rules

| Scenario | Rule | Implementation |
|----------|------|----------------|
| Both updated | Most recent `updatedAt` wins | Compare timestamps |
| Deleted in cloud | Also delete locally | Set `deletedAt` |
| New local record | Upload to cloud | Create on server |
| New cloud record | Insert into local DB | Create locally |
| Local deleted, cloud updated | Cloud wins (restore) | Update local |
| Cloud deleted, local updated | Local wins (undelete) | Keep local, notify |

### 5.3 Sync Queue Management

**Queue Structure:**
```typescript
interface SyncQueueItem {
  id: string;
  entity: 'product' | 'invoice' | 'payment' | ...;
  action: 'create' | 'update' | 'delete';
  localId: string;
  serverId?: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}
```

**Queue Processing:**
1. Process items in chronological order
2. Retry failed items (max 3 retries)
3. Batch upload (50 items per batch)
4. Handle network errors gracefully
5. Resume from last successful item

### 5.4 Sync Status Tracking

**Local Sync Status:**
```typescript
interface SyncStatus {
  lastSyncTime: Date | null;
  isSyncing: boolean;
  pendingChanges: number;
  failedItems: number;
  syncProgress: number; // 0-100
}
```

**Per-Record Sync Status:**
- `synced`: boolean
- `syncedAt`: timestamp
- `syncError`: error message (if failed)

---

## 6. Coding Standards

### 6.1 Naming Conventions

**APIs (camelCase):**
```typescript
getProducts()
createInvoice()
updateCustomer()
deleteProduct()
```

**Database Columns (snake_case):**
```sql
product_id
created_at
updated_at
is_active
```

**TypeScript Variables (camelCase):**
```typescript
const productName = 'Product 1';
const invoiceDate = new Date();
const isActive = true;
```

**TypeScript Types/Interfaces (PascalCase):**
```typescript
interface Product {}
type InvoiceStatus = 'PENDING' | 'PAID';
```

**Constants (UPPER_SNAKE_CASE):**
```typescript
const MAX_RETRY_COUNT = 3;
const DEFAULT_PAGE_SIZE = 50;
```

### 6.2 Code Standards

#### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

#### ESLint Rules
```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

#### DTO Validation
```typescript
import { z } from 'zod';

const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1),
  salePrice: z.number().positive(),
  purchasePrice: z.number().positive(),
});

type CreateProductDTO = z.infer<typeof CreateProductSchema>;
```

#### Error Handling
```typescript
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new AppError('User-friendly message', error);
}
```

### 6.3 File Organization

**One feature per file:**
- `product.controller.ts` - Product controller only
- `product.service.ts` - Product business logic
- `product.routes.ts` - Product routes
- `product.types.ts` - Product types

**Barrel exports:**
```typescript
// index.ts
export * from './product.controller';
export * from './product.service';
export * from './product.routes';
```

### 6.4 Git Commit Messages

**Format:**
```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Example:**
```
feat(invoice): add credit note support

- Add credit note invoice type
- Implement credit note creation
- Update invoice validation
```

---

## 7. Testing Requirements

### 7.1 Testing Types

#### Unit Testing
- **Framework:** Jest
- **Coverage Target:** 80%+
- **Test Files:** `*.test.ts` or `*.spec.ts`

**Example:**
```typescript
describe('Product Service', () => {
  it('should create product', async () => {
    const product = await productService.create({
      name: 'Test Product',
      code: 'TEST001',
      salePrice: 100,
    });
    expect(product.id).toBeDefined();
    expect(product.name).toBe('Test Product');
  });
});
```

#### Integration Testing
- **Framework:** Jest + Supertest
- **Scope:** API endpoints
- **Database:** Test database (separate from dev)

**Example:**
```typescript
describe('POST /api/products', () => {
  it('should create product via API', async () => {
    const response = await request(app)
      .post('/api/products')
      .send({ name: 'Test', code: 'TEST001' })
      .expect(201);
    
    expect(response.body.data.name).toBe('Test');
  });
});
```

#### Sync Engine Testing
- Test offline operations
- Test conflict resolution
- Test sync queue
- Test network failures
- Test large data sync

#### GST Calculation Testing
- Test tax calculations
- Test rounding accuracy
- Test different GST rates
- Test IGST vs CGST+SGST

#### Performance Testing
- API load testing (100+ req/sec)
- Invoice generation speed (< 1 sec)
- Report generation (< 5 sec)
- Database query optimization

### 7.2 QA Checklist

- [ ] GST rounding accuracy (to 2 decimal places)
- [ ] Negative stock blocking
- [ ] Sync conflict resolution
- [ ] Large data performance (10,000+ records)
- [ ] Offline mode functionality
- [ ] Data validation
- [ ] Error handling
- [ ] Security (SQL injection, XSS)
- [ ] Authentication/Authorization
- [ ] Multi-tenant isolation

---

## 8. Deployment Architecture

### 8.1 Cloud Infrastructure

```
┌─────────────────────────────────────┐
│         Load Balancer               │
│      (Nginx / AWS ALB)              │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│  Backend    │  │  Backend     │
│  Instance 1 │  │  Instance 2 │
│  (Node.js)  │  │  (Node.js)   │
└──────┬──────┘  └──────┬───────┘
       │                │
       └───────┬────────┘
               │
       ┌───────▼────────┐
       │   PostgreSQL   │
       │   (Primary)    │
       └───────┬────────┘
               │
       ┌───────▼────────┐
       │   PostgreSQL   │
       │  (Read Replica) │
       └─────────────────┘

┌─────────────────────────────────────┐
│         Redis Cache                 │
│    (Session + Cache + Queue)        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         S3 Bucket                   │
│      (Backups + Files)              │
└─────────────────────────────────────┘
```

### 8.2 Desktop Deployment

**Auto-Update Server:**
- Electron updater service
- Version management
- Delta updates
- Code signing certificate

**Build Process:**
```bash
npm run build          # Build React app
npm run build:electron # Build Electron
npm run pack           # Package installer
npm run dist           # Create distribution
```

**Distribution:**
- Windows: NSIS installer
- Auto-update: electron-updater
- Code signing: Required for Windows

### 8.3 Mobile Deployment

**Android:**
- Play Store distribution
- In-app updates
- APK/AAB builds
- Version management

**Build Process:**
```bash
cd mobile
npm run build:android
npm run build:release
```

### 8.4 Environment Configuration

**Development:**
```env
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/gst_billing_dev
JWT_SECRET=dev-secret-key
API_PORT=3000
```

**Production:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://prod-db:5432/gst_billing
JWT_SECRET=<secure-random-key>
API_PORT=3000
REDIS_URL=redis://prod-redis:6379
S3_BUCKET=gst-billing-files
```

### 8.5 Monitoring & Logging

**Logging:**
- Winston/Pino for backend
- Structured logging (JSON)
- Log levels: error, warn, info, debug
- Log rotation

**Monitoring:**
- Health check endpoint: `/health`
- Error tracking: Sentry
- Performance: APM tools
- Uptime monitoring

**Backup:**
- Daily database backups
- S3 storage
- 30-day retention
- Point-in-time recovery

---

## Summary

This technical architecture provides:

✅ **Offline-first design** with local SQLite databases  
✅ **UUID-based primary keys** for distributed systems  
✅ **Soft-delete pattern** for data integrity  
✅ **Comprehensive sync engine** with conflict resolution  
✅ **Standardized API layer** with versioning  
✅ **Complete database schema** documentation  
✅ **Coding standards** and best practices  
✅ **Testing framework** and requirements  
✅ **Deployment architecture** for production  

The architecture is scalable, maintainable, and follows industry best practices for offline-first applications.

