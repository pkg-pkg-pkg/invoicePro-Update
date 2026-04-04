# API Documentation - Complete Developer Specification

## Table of Contents

1. [Base Information](#1-base-information)
2. [Authentication APIs](#2-authentication-apis)
3. [Product Module APIs](#3-product-module-apis)
4. [Party Module APIs](#4-party-module-apis)
5. [Sales Invoice APIs](#5-sales-invoice-apis)
6. [Purchase APIs](#6-purchase-apis)
7. [Payments APIs](#7-payments-apis)
8. [Expense APIs](#8-expense-apis)
9. [Reporting APIs](#9-reporting-apis)
10. [Sync APIs](#10-sync-apis)
11. [Error Responses](#11-error-responses)

---

## 1. Base Information

### Base URL

```
Production: https://api.yourbillingapp.com/api/v1
Development: http://localhost:3000/api/v1
```

### Content-Type

All requests and responses use:
```
Content-Type: application/json
```

### Authentication Method

**JWT Bearer Token**

- Token expiry: 24 hours
- Refresh token supported
- Include token in Authorization header:

```
Authorization: Bearer <access_token>
```

### Response Format

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
  "code": "ERROR_CODE"
}
```

---

## 2. Authentication APIs

### 2.1 POST /auth/login

**Purpose:** Login user and generate access token

**Request:**
```json
{
  "username": "admin",
  "password": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "role": "ADMIN",
    "companyId": "company-uuid"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

---

### 2.2 POST /auth/refresh

**Purpose:** Get new access token using refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "new_access_token_here",
  "refreshToken": "new_refresh_token_here"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid or expired refresh token",
  "code": "INVALID_REFRESH_TOKEN"
}
```

---

### 2.3 POST /auth/logout

**Purpose:** Logout user and invalidate token

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 2.4 GET /auth/me

**Purpose:** Get current authenticated user information

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "role": "ADMIN",
    "companyId": "company-uuid",
    "company": {
      "id": "company-uuid",
      "name": "My Company",
      "gstin": "27ABCDE1234F1Z5"
    }
  }
}
```

---

## 3. Product Module APIs

### 3.1 GET /products

**Purpose:** Fetch product list with pagination, search, and filters

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | number | Page number (default: 1) | `?page=1` |
| `limit` | number | Items per page (default: 50) | `?limit=50` |
| `search` | string | Search by name, code, or barcode | `?search=milk` |
| `categoryId` | string | Filter by category | `?categoryId=uuid` |
| `lowStock` | boolean | Show only low stock items | `?lowStock=true` |
| `isActive` | boolean | Filter by active status | `?isActive=true` |
| `updatedAfter` | string | ISO timestamp for sync | `?updatedAfter=2024-12-06T10:00:00Z` |
| `sortBy` | string | Sort field (default: name) | `?sortBy=name` |
| `sortOrder` | string | Sort order: asc/desc (default: asc) | `?sortOrder=desc` |

**Example Request:**
```
GET /api/v1/products?page=1&limit=50&search=milk&categoryId=uuid&lowStock=true
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Milk 1 Ltr",
      "code": "MILK001",
      "categoryId": "category-uuid",
      "category": {
        "id": "category-uuid",
        "name": "Dairy"
      },
      "hsnCode": "0401",
      "sacCode": null,
      "uqc": "LTR",
      "unit": "LTR",
      "mrp": 60,
      "salePrice": 55,
      "purchasePrice": 45,
      "wholesalePrice": 50,
      "distributorPrice": 48,
      "openingStock": 100,
      "currentStock": 85,
      "lowStockAlert": 10,
      "minStock": 10,
      "barcode": "8901234567890",
      "images": [],
      "trackBatch": false,
      "trackSerial": false,
      "trackExpiry": false,
      "isActive": true,
      "createdAt": "2024-12-01T10:00:00Z",
      "updatedAt": "2024-12-06T10:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "totalPages": 10
  }
}
```

---

### 3.2 GET /products/:id

**Purpose:** Get single product by ID

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Milk 1 Ltr",
    "code": "MILK001",
    // ... same structure as list response
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

---

### 3.3 POST /products

**Purpose:** Create new product

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "New Product",
  "code": "NEW001",
  "categoryId": "category-uuid",
  "hsnCode": "3004",
  "sacCode": null,
  "uqc": "PCS",
  "unit": "PCS",
  "mrp": 100,
  "salePrice": 90,
  "purchasePrice": 70,
  "wholesalePrice": 85,
  "distributorPrice": 80,
  "openingStock": 20,
  "lowStockAlert": 5,
  "minStock": 5,
  "barcode": "8901234567891",
  "images": [],
  "trackBatch": false,
  "trackSerial": false,
  "trackExpiry": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "New Product",
    "code": "NEW001",
    // ... complete product object
  },
  "message": "Product created successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Product code already exists",
  "code": "DUPLICATE_CODE"
}
```

---

### 3.4 PUT /products/:id

**Purpose:** Update existing product

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "Updated Product Name",
  "salePrice": 95,
  "purchasePrice": 75
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Product Name",
    // ... updated product object
  },
  "message": "Product updated successfully"
}
```

---

### 3.5 DELETE /products/:id

**Purpose:** Soft-delete product

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

### 3.6 GET /products/barcode/:barcode

**Purpose:** Find product by barcode

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Milk 1 Ltr",
    "barcode": "8901234567890",
    // ... product object
  }
}
```

---

### 3.7 GET /products/low-stock

**Purpose:** Get products with low stock

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-uuid",
      "name": "Product Name",
      "currentStock": 5,
      "lowStockAlert": 10,
      "requiredQty": 5
    }
  ]
}
```

---

### 3.8 POST /products/bulk-stock

**Purpose:** Bulk update stock for multiple products

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "updates": [
    {
      "productId": "product-uuid-1",
      "quantity": 10,
      "type": "ADJUSTMENT"
    },
    {
      "productId": "product-uuid-2",
      "quantity": -5,
      "type": "ADJUSTMENT"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Stock updated successfully",
  "data": {
    "updated": 2
  }
}
```

---

## 4. Party Module APIs

### 4.1 GET /customers

**Purpose:** Fetch customer list

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `search` | string | Search by name, phone, GSTIN |
| `hasOutstanding` | boolean | Show only with outstanding |
| `group` | string | Filter by customer group |
| `sortBy` | string | Sort field |
| `sortOrder` | string | Sort order |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Ram Traders",
      "code": "CUST001",
      "gstin": "27ABCDE1234F1Z5",
      "pan": "ABCDE1234F",
      "group": "WHOLESALE",
      "creditLimit": 50000,
      "creditDays": 30,
      "phone": "9876543210",
      "email": "ram@example.com",
      "addressLine1": "123 Main Street",
      "addressLine2": "Near Market",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "openingBalance": 2000,
      "currentBalance": 3500,
      "isActive": true,
      "createdAt": "2024-12-01T10:00:00Z",
      "updatedAt": "2024-12-06T10:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

### 4.2 GET /customers/:id

**Purpose:** Get single customer

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "customer-uuid",
    "name": "Ram Traders",
    // ... complete customer object
  }
}
```

---

### 4.3 POST /customers

**Purpose:** Create new customer

**Request:**
```json
{
  "name": "ABC Store",
  "code": "CUST002",
  "gstin": "07ABCDE1234G2Z7",
  "pan": "ABCDE1234F",
  "group": "RETAIL",
  "creditLimit": 20000,
  "creditDays": 15,
  "phone": "9876543210",
  "email": "abc@example.com",
  "addressLine1": "456 Market Road",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "customer-uuid",
    // ... complete customer object
  },
  "message": "Customer created successfully"
}
```

---

### 4.4 PUT /customers/:id

**Purpose:** Update customer

---

### 4.5 DELETE /customers/:id

**Purpose:** Soft-delete customer

---

### 4.6 GET /customers/:id/ledger

**Purpose:** Get customer transaction ledger

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "customer-uuid",
      "name": "Ram Traders"
    },
    "transactions": [
      {
        "date": "2024-12-01",
        "type": "INVOICE",
        "reference": "INV-001",
        "debit": 5000,
        "credit": 0,
        "balance": 5000
      },
      {
        "date": "2024-12-02",
        "type": "PAYMENT",
        "reference": "RCP-001",
        "debit": 0,
        "credit": 2000,
        "balance": 3000
      }
    ],
    "summary": {
      "openingBalance": 0,
      "totalDebit": 5000,
      "totalCredit": 2000,
      "closingBalance": 3000
    }
  }
}
```

---

### 4.7 GET /customers/outstanding

**Purpose:** Get customers with outstanding balances

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "customer-uuid",
      "name": "Ram Traders",
      "totalOutstanding": 3500,
      "current": 2000,
      "days30": 1000,
      "days60": 500,
      "days90": 0,
      "days90Plus": 0
    }
  ],
  "summary": {
    "totalOutstanding": 50000,
    "totalCustomers": 25
  }
}
```

---

### 4.8 GET /suppliers

**Purpose:** Fetch supplier list (same structure as customers)

**Query Parameters:** Same as customers

**Response:** Same structure as customers

---

### 4.9 POST /suppliers

**Purpose:** Create new supplier

**Request:** Same structure as customer creation

---

## 5. Sales Invoice APIs

### 5.1 GET /invoices

**Purpose:** Fetch invoice list (sales and purchase)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | SALES_INVOICE, PURCHASE_INVOICE, etc. |
| `fromDate` | string | Start date (YYYY-MM-DD) |
| `toDate` | string | End date (YYYY-MM-DD) |
| `partyId` | string | Customer/Supplier ID |
| `partyType` | string | CUSTOMER or SUPPLIER |
| `paymentStatus` | string | PENDING, PARTIAL, PAID |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Example Request:**
```
GET /api/v1/invoices?type=SALES_INVOICE&fromDate=2024-12-01&toDate=2024-12-31&customerId=uuid&status=paid
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "invoiceNumber": "INV-001",
      "type": "SALES_INVOICE",
      "date": "2024-12-01",
      "partyId": "customer-uuid",
      "partyType": "CUSTOMER",
      "subtotal": 4000,
      "discount": 0,
      "discountType": "PERCENTAGE",
      "roundOff": 0,
      "cgst": 360,
      "sgst": 360,
      "igst": 0,
      "totalTax": 720,
      "grandTotal": 4720,
      "paymentStatus": "PAID",
      "paymentMode": ["CASH"],
      "notes": null,
      "isCancelled": false,
      "items": [
        {
          "id": "item-uuid",
          "productId": "product-uuid",
          "product": {
            "name": "Product Name"
          },
          "name": "Product Name",
          "quantity": 2,
          "rate": 2000,
          "taxableAmount": 4000,
          "gstRate": 18,
          "cgst": 360,
          "sgst": 360,
          "totalTax": 720,
          "totalAmount": 4720
        }
      ],
      "payments": [
        {
          "id": "payment-uuid",
          "amount": 4720,
          "paymentMode": "CASH",
          "date": "2024-12-01"
        }
      ],
      "createdAt": "2024-12-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 216,
    "totalPages": 5
  }
}
```

---

### 5.2 GET /invoices/:id

**Purpose:** Get single invoice with full details

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid",
    "invoiceNumber": "INV-001",
    // ... complete invoice object with items and payments
  }
}
```

---

### 5.3 POST /invoices

**Purpose:** Create new invoice (sales or purchase)

**Request:**
```json
{
  "invoiceNumber": "INV-101",
  "type": "SALES_INVOICE",
  "date": "2024-12-06",
  "partyId": "customer-uuid",
  "partyType": "CUSTOMER",
  "items": [
    {
      "productId": "product-uuid",
      "name": "Product Name",
      "hsnCode": "3004",
      "quantity": 2,
      "unit": "PCS",
      "rate": 500,
      "discount": 0,
      "discountType": "PERCENTAGE",
      "gstRate": 18
    }
  ],
  "discount": 0,
  "discountType": "PERCENTAGE",
  "roundOff": 1,
  "paymentStatus": "PARTIAL",
  "paymentMode": ["CASH"],
  "notes": "Thank you for your business",
  "terms": "Payment due in 30 days"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid",
    "invoiceNumber": "INV-101",
    // ... complete invoice object
  },
  "message": "Invoice created successfully"
}
```

**Note:** System automatically calculates:
- Taxable amount
- CGST, SGST, IGST
- Total tax
- Grand total

---

### 5.4 PUT /invoices/:id

**Purpose:** Update invoice (before payment)

**Request:** Same structure as create, with updated fields

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    // ... updated invoice object
  },
  "message": "Invoice updated successfully"
}
```

---

### 5.5 DELETE /invoices/:id

**Purpose:** Cancel invoice (soft delete)

**Request:**
```json
{
  "reason": "Cancelled by customer request"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Invoice cancelled successfully"
}
```

---

### 5.6 POST /invoices/:id/cancel

**Purpose:** Cancel invoice with reason

**Request:**
```json
{
  "reason": "Customer requested cancellation",
  "notes": "Full refund processed"
}
```

---

## 6. Purchase APIs

### 6.1 GET /invoices?type=PURCHASE_INVOICE

**Purpose:** Fetch purchase invoices

**Query Parameters:** Same as sales invoices

**Response:** Same structure as sales invoices

---

### 6.2 POST /invoices (with type=PURCHASE_INVOICE)

**Purpose:** Create purchase invoice

**Request:** Same structure as sales invoice, but:
- `type`: "PURCHASE_INVOICE"
- `partyType`: "SUPPLIER"
- `partyId`: supplier ID

---

## 7. Payments APIs

### 7.1 GET /payments

**Purpose:** Fetch payment list

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | RECEIPT or PAYMENT |
| `partyType` | string | CUSTOMER or SUPPLIER |
| `partyId` | string | Party ID |
| `paymentMode` | string | CASH, UPI, CARD, etc. |
| `fromDate` | string | Start date |
| `toDate` | string | End date |
| `invoiceId` | string | Filter by invoice |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "RECEIPT",
      "partyId": "customer-uuid",
      "partyType": "CUSTOMER",
      "party": {
        "id": "customer-uuid",
        "name": "Ram Traders"
      },
      "amount": 1500,
      "paymentMode": "UPI",
      "referenceNumber": "TXN8899",
      "chequeNumber": null,
      "chequeDate": null,
      "bankId": null,
      "bank": null,
      "invoiceId": "invoice-uuid",
      "invoice": {
        "id": "invoice-uuid",
        "invoiceNumber": "INV-001"
      },
      "notes": "Payment received",
      "date": "2024-12-06",
      "createdAt": "2024-12-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

### 7.2 GET /payments/:id

**Purpose:** Get single payment

---

### 7.3 POST /payments

**Purpose:** Create payment (receipt or payment)

**Request:**
```json
{
  "type": "RECEIPT",
  "partyId": "customer-uuid",
  "partyType": "CUSTOMER",
  "amount": 1500,
  "paymentMode": "UPI",
  "referenceNumber": "TXN8899",
  "bankId": null,
  "invoiceId": "invoice-uuid",
  "notes": "Payment received via UPI",
  "date": "2024-12-06"
}
```

**For Cheque Payment:**
```json
{
  "type": "RECEIPT",
  "partyId": "customer-uuid",
  "partyType": "CUSTOMER",
  "amount": 5000,
  "paymentMode": "CHEQUE",
  "chequeNumber": "123456",
  "chequeDate": "2024-12-10",
  "bankId": "bank-uuid",
  "invoiceId": "invoice-uuid",
  "date": "2024-12-06"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "payment-uuid",
    // ... complete payment object
  },
  "message": "Payment created successfully"
}
```

**Note:** System automatically:
- Updates party balance
- Updates bank balance (if bank selected)
- Updates invoice payment status

---

### 7.4 PUT /payments/:id

**Purpose:** Update payment

---

### 7.5 DELETE /payments/:id

**Purpose:** Delete payment (reverts balances)

---

### 7.6 GET /payments/summary

**Purpose:** Get payment summary

**Query Parameters:**
- `fromDate`: Start date
- `toDate`: End date

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "receipts": {
      "total": 500000,
      "count": 150
    },
    "payments": {
      "total": 300000,
      "count": 100
    },
    "net": 200000,
    "byMode": [
      {
        "mode": "CASH",
        "total": 200000
      },
      {
        "mode": "UPI",
        "total": 150000
      },
      {
        "mode": "CARD",
        "total": 100000
      }
    ]
  }
}
```

---

## 8. Expense APIs

### 8.1 GET /expenses

**Purpose:** Fetch expense list

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category |
| `fromDate` | string | Start date |
| `toDate` | string | End date |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "category": "Electricity",
      "amount": 6000,
      "date": "2024-12-05",
      "paymentMode": "BANK_TRANSFER",
      "bankId": "bank-uuid",
      "remarks": "Monthly EB Bill",
      "attachment": null,
      "createdAt": "2024-12-05T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 50,
    "totalPages": 1
  }
}
```

---

### 8.2 POST /expenses

**Purpose:** Create new expense

**Request:**
```json
{
  "category": "Electricity",
  "amount": 6000,
  "date": "2024-12-05",
  "paymentMode": "BANK_TRANSFER",
  "bankId": "bank-uuid",
  "remarks": "Monthly EB Bill",
  "attachment": null
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "expense-uuid",
    // ... complete expense object
  },
  "message": "Expense created successfully"
}
```

---

### 8.3 PUT /expenses/:id

**Purpose:** Update expense

---

### 8.4 DELETE /expenses/:id

**Purpose:** Delete expense

---

## 9. Reporting APIs

### 9.1 GET /reports/sales/register

**Purpose:** Sales register report

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fromDate` | string | Start date (YYYY-MM-DD) |
| `toDate` | string | End date (YYYY-MM-DD) |
| `customerId` | string | Filter by customer |
| `productId` | string | Filter by product |
| `categoryId` | string | Filter by category |
| `paymentStatus` | string | PENDING, PARTIAL, PAID |
| `invoiceStatus` | string | active, cancelled |
| `minAmount` | number | Minimum amount |
| `maxAmount` | number | Maximum amount |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "invoice-uuid",
      "date": "2024-12-01",
      "invoiceNumber": "INV-001",
      "partyId": "customer-uuid",
      "products": "Product 1, Product 2",
      "subtotal": 4000,
      "totalTax": 720,
      "grandTotal": 4720,
      "paid": 4720,
      "balance": 0,
      "paymentStatus": "PAID"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 216,
    "totalPages": 3
  },
  "summary": {
    "totalInvoices": 216,
    "totalAmount": 1000000,
    "totalPaid": 950000,
    "totalBalance": 50000,
    "totalTax": 180000
  }
}
```

---

### 9.2 GET /reports/sales/summary

**Purpose:** Sales summary report

**Query Parameters:**
- `fromDate`: Start date
- `toDate`: End date
- `groupBy`: day, week, month, year

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "period": "2024-12-01",
      "invoices": 10,
      "quantity": 50,
      "taxableAmount": 40000,
      "tax": 7200,
      "total": 47200
    }
  ],
  "total": {
    "invoices": 216,
    "quantity": 1080,
    "taxableAmount": 864000,
    "tax": 155520,
    "total": 1019520
  }
}
```

---

### 9.3 GET /reports/sales/by-customer

**Purpose:** Sales by customer report

**Query Parameters:**
- `fromDate`: Start date
- `toDate`: End date
- `topN`: Limit to top N customers

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "customerId": "customer-uuid",
      "customerName": "Ram Traders",
      "invoices": 25,
      "quantity": 150,
      "totalAmount": 150000,
      "paid": 140000,
      "balance": 10000,
      "averageInvoiceValue": 6000,
      "lastPurchaseDate": "2024-12-06"
    }
  ],
  "total": {
    "customers": 50,
    "invoices": 500,
    "totalAmount": 5000000,
    "totalPaid": 4800000,
    "totalBalance": 200000
  }
}
```

---

### 9.4 GET /reports/sales/by-product

**Purpose:** Sales by product report

**Query Parameters:**
- `fromDate`: Start date
- `toDate`: End date
- `categoryId`: Filter by category

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "productId": "product-uuid",
      "productCode": "PROD001",
      "productName": "Product Name",
      "category": "Category Name",
      "quantity": 100,
      "amount": 50000,
      "averageRate": 500
    }
  ],
  "total": {
    "products": 50,
    "quantity": 5000,
    "amount": 2500000
  }
}
```

---

### 9.5 GET /reports/purchase/register

**Purpose:** Purchase register report

**Same structure as sales register**

---

### 9.6 GET /reports/stock/current

**Purpose:** Current stock summary

**Query Parameters:**
- `categoryId`: Filter by category
- `showOnly`: outOfStock, lowStock, inStock
- `minStock`: Minimum stock
- `maxStock`: Maximum stock

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-uuid",
      "code": "PROD001",
      "name": "Product Name",
      "category": "Category",
      "currentStock": 85,
      "unit": "PCS",
      "purchasePrice": 45,
      "salePrice": 55,
      "stockValue": 3825,
      "saleValue": 4675,
      "lowStockAlert": 10,
      "isLowStock": false
    }
  ],
  "summary": {
    "totalProducts": 500,
    "totalStockValue": 5000000,
    "totalSaleValue": 6000000,
    "lowStockCount": 25,
    "outOfStockCount": 5
  }
}
```

---

### 9.7 GET /reports/financial/profit-loss

**Purpose:** Profit & Loss statement

**Query Parameters:**
- `fromDate`: Start date
- `toDate`: End date

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2024-12-01",
      "to": "2024-12-31"
    },
    "income": {
      "sales": 1000000,
      "salesReturns": 50000,
      "netSales": 950000,
      "otherIncome": 10000,
      "totalIncome": 960000
    },
    "expenses": {
      "purchases": 600000,
      "purchaseReturns": 30000,
      "netPurchase": 570000,
      "costOfGoodsSold": 550000,
      "operatingExpenses": 100000,
      "totalExpenses": 650000
    },
    "profit": {
      "grossProfit": 400000,
      "netProfit": 300000,
      "profitPercentage": 31.25
    }
  }
}
```

---

### 9.8 GET /reports/party/customer-outstanding

**Purpose:** Customer outstanding report with aging

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "customerId": "customer-uuid",
      "customerName": "Ram Traders",
      "phone": "9876543210",
      "email": "ram@example.com",
      "totalOutstanding": 3500,
      "current": 2000,
      "days30": 1000,
      "days60": 500,
      "days90": 0,
      "days90Plus": 0,
      "invoiceCount": 3
    }
  ],
  "summary": {
    "totalCustomers": 25,
    "totalOutstanding": 50000,
    "totalCurrent": 30000,
    "totalDays30": 15000,
    "totalDays60": 5000,
    "totalDays90": 0,
    "totalDays90Plus": 0
  }
}
```

---

### 9.9 GET /reports/gst/gstr1

**Purpose:** GSTR-1 report (GST portal format)

**Query Parameters:**
- `fromDate`: Start date (month start)
- `toDate`: End date (month end)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "b2b": [
      {
        "ctin": "27ABCDE1234F1Z5",
        "inv": [
          {
            "inum": "INV-001",
            "idt": "2024-12-01",
            "val": 4720,
            "pos": "27",
            "rchrg": "N",
            "inv_typ": "R",
            "itms": [
              {
                "num": 1,
                "itm_det": {
                  "hsn_sc": "3004",
                  "qty": 2,
                  "rt": 18,
                  "txval": 4000,
                  "iamt": 360,
                  "camt": 360,
                  "samt": 360
                }
              }
            ]
          }
        ]
      }
    ],
    "b2c": [
      // B2C invoices
    ],
    "hsn": [
      {
        "hsn_sc": "3004",
        "qty": 100,
        "rt": 18,
        "txval": 200000,
        "iamt": 18000,
        "camt": 18000,
        "samt": 18000
      }
    ]
  }
}
```

---

### 9.10 GET /reports/gst/gstr3b

**Purpose:** GSTR-3B monthly summary

**Query Parameters:**
- `fromDate`: Month start
- `toDate`: Month end

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "outwardSupplies": {
      "taxableValue": 1000000,
      "cgst": 90000,
      "sgst": 90000,
      "igst": 0,
      "cess": 0
    },
    "itcAvailable": {
      "cgst": 50000,
      "sgst": 50000,
      "igst": 0,
      "cess": 0
    },
    "itcReversed": {
      "cgst": 0,
      "sgst": 0,
      "igst": 0,
      "cess": 0
    },
    "netItcAvailable": {
      "cgst": 50000,
      "sgst": 50000,
      "igst": 0,
      "cess": 0
    },
    "taxPayable": {
      "cgst": 40000,
      "sgst": 40000,
      "igst": 0,
      "cess": 0
    }
  }
}
```

---

## 10. Sync APIs

### 10.1 POST /sync/upload

**Purpose:** Upload unsynced data from Desktop/Mobile to Cloud

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "deviceId": "device-unique-id",
  "lastSyncTime": "2024-12-06T09:00:00Z",
  "changes": {
    "products": [
      {
        "id": "local-product-uuid",
        "action": "create",
        "data": {
          "name": "New Product",
          "code": "NEW001",
          "salePrice": 100,
          "purchasePrice": 80
        },
        "timestamp": "2024-12-06T10:00:00Z"
      },
      {
        "id": "existing-product-uuid",
        "action": "update",
        "data": {
          "salePrice": 110
        },
        "timestamp": "2024-12-06T10:30:00Z"
      }
    ],
    "invoices": [
      {
        "id": "local-invoice-uuid",
        "action": "create",
        "data": {
          "invoiceNumber": "INV-101",
          "date": "2024-12-06",
          "customerId": "customer-uuid",
          "items": [...],
          "grandTotal": 5000
        },
        "timestamp": "2024-12-06T11:00:00Z"
      }
    ],
    "payments": [
      {
        "id": "local-payment-uuid",
        "action": "create",
        "data": {
          "type": "RECEIPT",
          "amount": 5000,
          "paymentMode": "CASH",
          "date": "2024-12-06"
        },
        "timestamp": "2024-12-06T11:30:00Z"
      }
    ],
    "customers": [],
    "suppliers": [],
    "expenses": [],
    "stockLedger": []
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "results": {
    "created": [
      {
        "entityType": "products",
        "localId": "local-product-uuid",
        "serverId": "server-product-uuid"
      },
      {
        "entityType": "invoices",
        "localId": "local-invoice-uuid",
        "serverId": "server-invoice-uuid"
      }
    ],
    "updated": [
      {
        "entityType": "products",
        "id": "existing-product-uuid"
      }
    ],
    "errors": []
  },
  "syncedAt": "2024-12-06T12:00:00Z",
  "message": "Data synced successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Missing required fields: deviceId, changes",
  "code": "VALIDATION_ERROR"
}
```

---

### 10.2 GET /sync/download

**Purpose:** Download cloud updates to Desktop/Mobile

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lastSyncTime` | string | ISO timestamp of last sync |
| `deviceId` | string | Device unique identifier |

**Example Request:**
```
GET /api/v1/sync/download?lastSyncTime=2024-12-06T09:00:00Z&deviceId=device-uuid
```

**Response (200 OK):**
```json
{
  "success": true,
  "lastSyncTime": "2024-12-06T12:00:00Z",
  "updates": {
    "products": [
      {
        "id": "product-uuid",
        "name": "Updated Product",
        "code": "PROD001",
        "salePrice": 120,
        "updatedAt": "2024-12-06T11:00:00Z",
        "syncedAt": "2024-12-06T12:00:00Z"
      }
    ],
    "customers": [
      {
        "id": "customer-uuid",
        "name": "New Customer",
        "phone": "9876543210",
        "updatedAt": "2024-12-06T10:00:00Z",
        "syncedAt": "2024-12-06T12:00:00Z"
      }
    ],
    "suppliers": [],
    "invoices": [
      {
        "id": "invoice-uuid",
        "invoiceNumber": "INV-102",
        "date": "2024-12-06",
        "grandTotal": 6000,
        "items": [...],
        "updatedAt": "2024-12-06T11:30:00Z",
        "syncedAt": "2024-12-06T12:00:00Z"
      }
    ],
    "payments": [],
    "bankAccounts": [],
    "expenses": [],
    "stockLedger": []
  },
  "conflicts": [
    {
      "entityType": "products",
      "entityId": "product-uuid",
      "localData": {
        "name": "Local Name",
        "updatedAt": "2024-12-06T10:00:00Z"
      },
      "cloudData": {
        "name": "Cloud Name",
        "updatedAt": "2024-12-06T11:00:00Z"
      },
      "localTimestamp": "2024-12-06T10:00:00Z",
      "cloudTimestamp": "2024-12-06T11:00:00Z"
    }
  ],
  "summary": {
    "totalRecords": 150,
    "conflictsCount": 1,
    "products": 50,
    "customers": 30,
    "invoices": 50,
    "payments": 20
  }
}
```

---

### 10.3 GET /sync/status

**Purpose:** Get sync status and pending changes count

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `deviceId`: Device unique identifier

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "lastSyncTime": "2024-12-06T09:00:00Z",
    "isSyncing": false,
    "pendingChanges": 5,
    "pendingCounts": {
      "products": 2,
      "invoices": 2,
      "payments": 1,
      "customers": 0,
      "suppliers": 0
    },
    "deviceId": "device-uuid"
  }
}
```

---

### 10.4 POST /sync/resolve-conflict

**Purpose:** Resolve data conflict manually

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "entityType": "products",
  "entityId": "product-uuid",
  "resolution": "local",
  "localData": {
    "name": "Local Name",
    "updatedAt": "2024-12-06T10:00:00Z"
  },
  "cloudData": {
    "name": "Cloud Name",
    "updatedAt": "2024-12-06T11:00:00Z"
  }
}
```

**Resolution Options:**
- `"local"`: Use local data
- `"cloud"`: Use cloud data
- `"merge"`: Merge both (cloud data with local overrides)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Conflict resolved",
  "resolvedAt": "2024-12-06T12:00:00Z"
}
```

---

### 10.5 GET /sync/history

**Purpose:** Get sync history logs

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `deviceId`: Device ID (optional)
- `page`: Page number
- `limit`: Items per page

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "deviceId": "device-uuid",
      "entity": "sync",
      "action": "upload",
      "data": {
        "recordCounts": {
          "products": 10,
          "invoices": 5
        }
      },
      "timestamp": "2024-12-06T09:00:00Z",
      "syncedAt": "2024-12-06T09:05:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

## 11. Error Responses

### 11.1 Standard Error Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

### 11.2 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST (create) |
| 400 | Bad Request | Validation errors, invalid input |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate data, conflict |
| 500 | Internal Server Error | Server error |

### 11.3 Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `INVALID_CREDENTIALS` | Wrong username/password |
| `INVALID_TOKEN` | Invalid or expired token |
| `NOT_FOUND` | Resource not found |
| `DUPLICATE_CODE` | Product/customer code already exists |
| `INSUFFICIENT_STOCK` | Not enough stock available |
| `UNAUTHORIZED` | Not authorized to perform action |
| `SYNC_ERROR` | Sync operation failed |

### 11.4 Error Response Examples

**Validation Error (400):**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": {
      "name": "Product name is required",
      "salePrice": "Sale price must be greater than 0"
    }
  }
}
```

**Not Found (404):**
```json
{
  "success": false,
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

**Unauthorized (401):**
```json
{
  "success": false,
  "error": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}
```

**Conflict (409):**
```json
{
  "success": false,
  "error": "Product code already exists",
  "code": "DUPLICATE_CODE"
}
```

---

## 12. Rate Limiting

**Limits:**
- 100 requests per minute per IP
- 1000 requests per hour per user

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1638784800
```

**Rate Limit Exceeded (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

## 13. Pagination

**Standard Pagination:**
- Default page: 1
- Default limit: 50
- Maximum limit: 1000

**Response Format:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

---

## 14. Date Formats

**All dates use ISO 8601 format:**
- Date: `YYYY-MM-DD` (e.g., `2024-12-06`)
- DateTime: `YYYY-MM-DDTHH:mm:ssZ` (e.g., `2024-12-06T10:30:00Z`)

---

## 15. WebSocket Events (Optional)

**Connection:**
```
ws://api.yourbillingapp.com/ws?token=<access_token>
```

**Events:**
- `sync-request`: Request sync
- `sync-data`: Sync data transfer
- `sync-complete`: Sync completion
- `error`: Error notification

---

## Summary

This API documentation provides:

✅ **Complete endpoint specifications**  
✅ **Request/Response examples**  
✅ **Query parameters** documentation  
✅ **Error handling** standards  
✅ **Authentication** flow  
✅ **Sync APIs** for offline-first  
✅ **Reporting APIs** with filters  
✅ **Pagination** standards  
✅ **Rate limiting** information  

All APIs follow RESTful principles and are ready for integration with Desktop and Mobile applications.

