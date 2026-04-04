# Testing Guide - Complete Testing Strategy

## Table of Contents

1. [Testing Overview](#1-testing-overview)
2. [Unit Testing](#2-unit-testing)
3. [Integration Testing](#3-integration-testing)
4. [Sync Engine Testing](#4-sync-engine-testing)
5. [GST Calculation Testing](#5-gst-calculation-testing)
6. [Performance Testing](#6-performance-testing)
7. [QA Checklist](#7-qa-checklist)

---

## 1. Testing Overview

### Testing Pyramid

```
        ┌─────────────┐
        │     E2E     │  (10%)
        │   Tests     │
        ├─────────────┤
        │ Integration │  (30%)
        │   Tests     │
        ├─────────────┤
        │    Unit     │  (60%)
        │   Tests     │
        └─────────────┘
```

### Coverage Targets

- **Overall:** 80%+
- **Business Logic:** 90%+
- **Utilities:** 80%+
- **Controllers:** 70%+
- **Critical Paths:** 100%

---

## 2. Unit Testing

### 2.1 Setup

**Backend:**
```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "supertest": "^6.0.0"
  }
}
```

**Jest Configuration:**
```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src"],
  "testMatch": ["**/__tests__/**/*.test.ts"],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

### 2.2 Example Unit Tests

**Product Service Test:**
```typescript
import { productService } from '../services/product.service';
import { prisma } from '../database';

describe('Product Service', () => {
  beforeEach(async () => {
    // Clean database
    await prisma.product.deleteMany();
  });

  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      const productData = {
        name: 'Test Product',
        code: 'TEST001',
        salePrice: 100,
        purchasePrice: 80,
        companyId: 'company-uuid',
      };

      const product = await productService.create(productData);

      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.code).toBe('TEST001');
    });

    it('should throw error for duplicate code', async () => {
      await productService.create({
        name: 'Product 1',
        code: 'TEST001',
        salePrice: 100,
        purchasePrice: 80,
        companyId: 'company-uuid',
      });

      await expect(
        productService.create({
          name: 'Product 2',
          code: 'TEST001', // Duplicate
          salePrice: 100,
          purchasePrice: 80,
          companyId: 'company-uuid',
        })
      ).rejects.toThrow('Product code already exists');
    });

    it('should validate required fields', async () => {
      await expect(
        productService.create({
          name: '', // Invalid
          code: 'TEST001',
          salePrice: 100,
          purchasePrice: 80,
          companyId: 'company-uuid',
        })
      ).rejects.toThrow('Product name is required');
    });
  });

  describe('updateProduct', () => {
    it('should update product', async () => {
      const product = await productService.create({
        name: 'Product 1',
        code: 'TEST001',
        salePrice: 100,
        purchasePrice: 80,
        companyId: 'company-uuid',
      });

      const updated = await productService.update(product.id, {
        salePrice: 120,
      });

      expect(updated.salePrice).toBe(120);
      expect(updated.name).toBe('Product 1'); // Unchanged
    });
  });
});
```

**GST Calculation Test:**
```typescript
import { calculateGST } from '../utils/gst';

describe('GST Calculation', () => {
  it('should calculate CGST and SGST for same state', () => {
    const result = calculateGST({
      taxableAmount: 1000,
      gstRate: 18,
      isInterState: false,
    });

    expect(result.cgst).toBe(90); // 9%
    expect(result.sgst).toBe(90); // 9%
    expect(result.igst).toBe(0);
    expect(result.totalTax).toBe(180);
  });

  it('should calculate IGST for inter-state', () => {
    const result = calculateGST({
      taxableAmount: 1000,
      gstRate: 18,
      isInterState: true,
    });

    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(180); // 18%
    expect(result.totalTax).toBe(180);
  });

  it('should round to 2 decimal places', () => {
    const result = calculateGST({
      taxableAmount: 100.33,
      gstRate: 18,
      isInterState: false,
    });

    expect(result.cgst).toBe(9.03); // Rounded
    expect(result.sgst).toBe(9.03);
    expect(result.totalTax).toBe(18.06);
  });
});
```

---

## 3. Integration Testing

### 3.1 API Integration Tests

```typescript
import request from 'supertest';
import app from '../index';
import { prisma } from '../database';

describe('Product API', () => {
  let authToken: string;
  let companyId: string;

  beforeAll(async () => {
    // Setup test data
    const company = await prisma.company.create({
      data: { name: 'Test Company', /* ... */ }
    });
    companyId = company.id;

    // Login to get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    
    authToken = response.body.token;
  });

  describe('GET /api/products', () => {
    it('should return products list', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/products?categoryId=category-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.every((p: any) => 
        p.categoryId === 'category-uuid'
      )).toBe(true);
    });
  });

  describe('POST /api/products', () => {
    it('should create product', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Product',
          code: 'NEW001',
          salePrice: 100,
          purchasePrice: 80,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Product');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Invalid
          code: 'NEW001',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });
});
```

---

## 4. Sync Engine Testing

### 4.1 Sync Flow Test

```typescript
describe('Sync Engine', () => {
  it('should upload local changes', async () => {
    // Create local product
    const localProduct = {
      id: 'local-uuid',
      name: 'Local Product',
      code: 'LOCAL001',
      synced: false,
    };

    // Upload to server
    const response = await syncService.upload({
      deviceId: 'device-1',
      changes: {
        products: [{
          id: localProduct.id,
          action: 'create',
          data: localProduct,
          timestamp: new Date(),
        }]
      }
    });

    expect(response.success).toBe(true);
    expect(response.results.created.length).toBe(1);
    expect(response.results.created[0].serverId).toBeDefined();
  });

  it('should download cloud updates', async () => {
    // Create product on server
    await productService.create({
      name: 'Cloud Product',
      code: 'CLOUD001',
      companyId: 'company-uuid',
    });

    // Download updates
    const response = await syncService.download({
      lastSyncTime: new Date('2024-01-01'),
      deviceId: 'device-1',
    });

    expect(response.updates.products.length).toBeGreaterThan(0);
    expect(response.updates.products[0].name).toBe('Cloud Product');
  });

  it('should resolve conflicts', async () => {
    const conflict = {
      entityType: 'products',
      entityId: 'product-uuid',
      localData: {
        name: 'Local Name',
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      },
      cloudData: {
        name: 'Cloud Name',
        updatedAt: new Date('2024-01-01T11:00:00Z'),
      },
    };

    const resolution = await syncService.resolveConflict(conflict, 'cloud');

    expect(resolution).toBe('cloud');
    // Verify cloud data is used
  });
});
```

### 4.2 Conflict Resolution Test

```typescript
describe('Conflict Resolution', () => {
  it('should use latest timestamp', () => {
    const local = { updatedAt: new Date('2024-01-01T10:00:00Z') };
    const cloud = { updatedAt: new Date('2024-01-01T11:00:00Z') };

    const resolution = resolveConflict(local, cloud);
    expect(resolution).toBe('cloud');
  });

  it('should handle deleted records', () => {
    const local = { deletedAt: new Date('2024-01-01T10:00:00Z') };
    const cloud = { updatedAt: new Date('2024-01-01T11:00:00Z') };

    const resolution = resolveConflict(local, cloud);
    // Cloud update is newer, restore record
    expect(resolution).toBe('cloud');
  });
});
```

---

## 5. GST Calculation Testing

### 5.1 Tax Calculation Tests

```typescript
describe('GST Calculations', () => {
  it('should calculate 5% GST correctly', () => {
    const result = calculateGST({
      taxableAmount: 1000,
      gstRate: 5,
      isInterState: false,
    });

    expect(result.cgst).toBe(25); // 2.5%
    expect(result.sgst).toBe(25); // 2.5%
    expect(result.totalTax).toBe(50);
  });

  it('should calculate 12% GST correctly', () => {
    const result = calculateGST({
      taxableAmount: 1000,
      gstRate: 12,
      isInterState: false,
    });

    expect(result.cgst).toBe(60); // 6%
    expect(result.sgst).toBe(60); // 6%
    expect(result.totalTax).toBe(120);
  });

  it('should calculate 18% GST correctly', () => {
    const result = calculateGST({
      taxableAmount: 1000,
      gstRate: 18,
      isInterState: false,
    });

    expect(result.cgst).toBe(90); // 9%
    expect(result.sgst).toBe(90); // 9%
    expect(result.totalTax).toBe(180);
  });

  it('should calculate 28% GST correctly', () => {
    const result = calculateGST({
      taxableAmount: 1000,
      gstRate: 28,
      isInterState: false,
    });

    expect(result.cgst).toBe(140); // 14%
    expect(result.sgst).toBe(140); // 14%
    expect(result.totalTax).toBe(280);
  });

  it('should round correctly to 2 decimals', () => {
    const result = calculateGST({
      taxableAmount: 100.33,
      gstRate: 18,
      isInterState: false,
    });

    expect(result.cgst).toBe(9.03);
    expect(result.sgst).toBe(9.03);
    expect(result.totalTax).toBe(18.06);
  });
});
```

### 5.2 Invoice GST Test

```typescript
describe('Invoice GST Calculation', () => {
  it('should calculate invoice totals correctly', () => {
    const items = [
      { taxableAmount: 1000, gstRate: 18 },
      { taxableAmount: 500, gstRate: 12 },
    ];

    const invoice = calculateInvoiceTotals(items, {
      discount: 0,
      roundOff: 0,
    });

    expect(invoice.subtotal).toBe(1500);
    expect(invoice.totalTax).toBe(240); // 180 + 60
    expect(invoice.grandTotal).toBe(1740);
  });

  it('should apply discount before GST', () => {
    const items = [
      { taxableAmount: 1000, gstRate: 18 },
    ];

    const invoice = calculateInvoiceTotals(items, {
      discount: 100,
      discountType: 'FIXED',
      roundOff: 0,
    });

    expect(invoice.subtotal).toBe(900); // 1000 - 100
    expect(invoice.totalTax).toBe(162); // 18% of 900
    expect(invoice.grandTotal).toBe(1062);
  });
});
```

---

## 6. Performance Testing

### 6.1 API Load Testing

**Using Artillery:**
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
scenarios:
  - name: "Get Products"
    flow:
      - get:
          url: "/api/products"
          headers:
            Authorization: "Bearer {{ token }}"
```

### 6.2 Database Query Performance

```typescript
describe('Database Performance', () => {
  it('should query 10,000 products in < 1 second', async () => {
    const start = Date.now();
    const products = await prisma.product.findMany({
      where: { companyId: 'company-uuid' },
      take: 10000,
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000);
    expect(products.length).toBe(10000);
  });

  it('should generate invoice in < 500ms', async () => {
    const start = Date.now();
    const invoice = await invoiceService.create({
      // ... invoice data
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
    expect(invoice.id).toBeDefined();
  });
});
```

---

## 7. QA Checklist

### 7.1 Functional Testing

- [ ] **GST Rounding Accuracy**
  - Test all GST rates (5%, 12%, 18%, 28%)
  - Verify rounding to 2 decimal places
  - Test edge cases (0.01, 0.99, etc.)

- [ ] **Negative Stock Blocking**
  - Attempt to sell more than available stock
  - Verify error message
  - Test with stock adjustment

- [ ] **Sync Conflict Resolution**
  - Create conflict scenario
  - Test automatic resolution
  - Test manual resolution

- [ ] **Large Data Performance**
  - Test with 10,000+ products
  - Test with 1,000+ invoices
  - Verify pagination works

- [ ] **Offline Mode**
  - Create invoice offline
  - Verify data saved locally
  - Sync when online
  - Verify data appears on other devices

### 7.2 Security Testing

- [ ] **SQL Injection**
  - Test with malicious input
  - Verify parameterized queries

- [ ] **XSS Prevention**
  - Test with script tags
  - Verify sanitization

- [ ] **Authentication**
  - Test invalid tokens
  - Test expired tokens
  - Test unauthorized access

- [ ] **Multi-tenant Isolation**
  - Verify company data isolation
  - Test cross-company access (should fail)

### 7.3 Data Validation

- [ ] **Required Fields**
  - Test missing required fields
  - Verify error messages

- [ ] **Data Types**
  - Test invalid types
  - Test out-of-range values

- [ ] **Business Rules**
  - Test credit limit enforcement
  - Test stock validation
  - Test date validations

---

## Running Tests

### Backend Tests

```bash
cd backend
npm test                 # Run all tests
npm test -- --watch     # Watch mode
npm test -- --coverage  # With coverage
npm test -- product     # Run specific test
```

### Desktop Tests

```bash
cd desktop
npm test
```

### Mobile Tests

```bash
cd mobile
npm test
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

---

## Summary

This testing guide provides:

✅ **Unit testing** framework and examples  
✅ **Integration testing** for APIs  
✅ **Sync engine** testing strategies  
✅ **GST calculation** accuracy tests  
✅ **Performance testing** guidelines  
✅ **QA checklist** for comprehensive testing  

Follow these guidelines to ensure code quality and reliability.

