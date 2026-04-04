# Coding Standards & Best Practices

## Table of Contents

1. [Naming Conventions](#1-naming-conventions)
2. [Code Formatting](#2-code-formatting)
3. [TypeScript Standards](#3-typescript-standards)
4. [Error Handling](#4-error-handling)
5. [API Design](#5-api-design)
6. [Database Standards](#6-database-standards)
7. [Testing Standards](#7-testing-standards)

---

## 1. Naming Conventions

### 1.1 APIs (camelCase)

```typescript
// ✅ Good
getProducts()
createInvoice()
updateCustomer()
deleteProduct()

// ❌ Bad
GetProducts()
create_invoice()
UpdateCustomer()
```

### 1.2 Database Columns (snake_case)

```sql
-- ✅ Good
product_id
created_at
updated_at
is_active
company_id

-- ❌ Bad
productId
createdAt
isActive
companyId
```

### 1.3 TypeScript Variables (camelCase)

```typescript
// ✅ Good
const productName = 'Product 1';
const invoiceDate = new Date();
const isActive = true;
const totalAmount = 1000.50;

// ❌ Bad
const product_name = 'Product 1';
const InvoiceDate = new Date();
const IsActive = true;
```

### 1.4 TypeScript Types/Interfaces (PascalCase)

```typescript
// ✅ Good
interface Product {}
type InvoiceStatus = 'PENDING' | 'PAID';
interface CreateProductData {}

// ❌ Bad
interface product {}
type invoiceStatus = 'PENDING' | 'PAID';
```

### 1.5 Constants (UPPER_SNAKE_CASE)

```typescript
// ✅ Good
const MAX_RETRY_COUNT = 3;
const DEFAULT_PAGE_SIZE = 50;
const API_BASE_URL = 'https://api.example.com';

// ❌ Bad
const maxRetryCount = 3;
const defaultPageSize = 50;
```

### 1.6 Files and Folders

**Files:**
- `camelCase.ts` for utilities
- `PascalCase.tsx` for React components
- `kebab-case.ts` for config files

**Folders:**
- `kebab-case` for folder names
- Examples: `product-service`, `invoice-controller`

---

## 2. Code Formatting

### 2.1 Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 2.2 ESLint Rules

```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### 2.3 Import Organization

```typescript
// 1. External libraries
import React from 'react';
import { useDispatch } from 'react-redux';
import { Box, Typography } from '@mui/material';

// 2. Internal modules
import { productService } from '../../services/productService';
import { formatCurrency } from '../../utils/formatters';

// 3. Types
import type { Product } from '../../../shared/src/types';

// 4. Relative imports
import ProductCard from './ProductCard';
```

---

## 3. TypeScript Standards

### 3.1 Type Safety

```typescript
// ✅ Good - Explicit types
function calculateTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

// ❌ Bad - Implicit any
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}
```

### 3.2 Interface Definitions

```typescript
// ✅ Good - Clear, documented interfaces
interface Product {
  /** Product unique identifier */
  id: string;
  /** Product name */
  name: string;
  /** Product code (SKU) */
  code: string;
  /** Sale price in INR */
  salePrice: number;
}

// ❌ Bad - Unclear, undocumented
interface Product {
  id: string;
  name: string;
  code: string;
  salePrice: number;
}
```

### 3.3 DTO Validation with Zod

```typescript
import { z } from 'zod';

// Define schema
const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  salePrice: z.number().positive(),
  purchasePrice: z.number().positive(),
  categoryId: z.string().uuid().optional(),
});

// Infer type
type CreateProductDTO = z.infer<typeof CreateProductSchema>;

// Validate
function createProduct(data: unknown): CreateProductDTO {
  return CreateProductSchema.parse(data);
}
```

---

## 4. Error Handling

### 4.1 Error Classes

```typescript
// Custom error classes
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}
```

### 4.2 Error Handling Pattern

```typescript
// ✅ Good - Proper error handling
export const getProduct = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id, companyId, isActive: true, deletedAt: null }
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    res.json(product);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    logger.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### 4.3 Async Error Handling

```typescript
// ✅ Good - Use try-catch with async/await
async function fetchData() {
  try {
    const data = await api.get('/data');
    return data;
  } catch (error) {
    logger.error('Fetch error:', error);
    throw new AppError('Failed to fetch data', 500);
  }
}

// ❌ Bad - Unhandled promise rejection
async function fetchData() {
  const data = await api.get('/data');
  return data;
}
```

---

## 5. API Design

### 5.1 RESTful Endpoints

```typescript
// ✅ Good - RESTful design
GET    /api/v1/products           // List
GET    /api/v1/products/:id       // Get one
POST   /api/v1/products           // Create
PUT    /api/v1/products/:id       // Update
DELETE /api/v1/products/:id       // Delete

// ❌ Bad - Non-RESTful
GET    /api/v1/getProducts
POST   /api/v1/createProduct
POST   /api/v1/updateProduct
POST   /api/v1/deleteProduct
```

### 5.2 Response Format

```typescript
// Success response
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}

// Paginated response
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

### 5.3 Request Validation

```typescript
// ✅ Good - Validate before processing
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const validatedData = CreateProductSchema.parse(req.body);

    // Business logic
    const product = await productService.create(validatedData);

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }
    // Handle other errors
  }
};
```

---

## 6. Database Standards

### 6.1 Query Patterns

```typescript
// ✅ Good - Use Prisma query builder
const products = await prisma.product.findMany({
  where: {
    companyId,
    isActive: true,
    deletedAt: null,
    currentStock: { lte: prisma.product.fields.lowStockAlert }
  },
  include: { category: true },
  orderBy: { name: 'asc' },
  take: 50,
  skip: 0
});

// ❌ Bad - Raw SQL (unless necessary)
const products = await prisma.$queryRaw`
  SELECT * FROM products WHERE company_id = ${companyId}
`;
```

### 6.2 Transaction Usage

```typescript
// ✅ Good - Use transactions for related operations
await prisma.$transaction(async (tx) => {
  // Create invoice
  const invoice = await tx.invoice.create({ data: invoiceData });

  // Create invoice items
  await tx.invoiceItem.createMany({
    data: items.map(item => ({ ...item, invoiceId: invoice.id }))
  });

  // Update stock
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { currentStock: { decrement: item.quantity } }
    });
  }

  return invoice;
});
```

### 6.3 Index Usage

```typescript
// Always index:
// - Foreign keys
// - Frequently queried fields
// - Date fields for time-based queries
// - Status fields for filtering

// Example in Prisma schema:
model Invoice {
  @@index([companyId, date, paymentStatus])
  @@index([partyId])
  @@index([type])
}
```

---

## 7. Testing Standards

### 7.1 Test File Naming

```
product.service.test.ts
product.controller.spec.ts
```

### 7.2 Test Structure

```typescript
describe('Product Service', () => {
  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      // Arrange
      const productData = {
        name: 'Test Product',
        code: 'TEST001',
        salePrice: 100,
      };

      // Act
      const product = await productService.create(productData);

      // Assert
      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
    });

    it('should throw error for invalid data', async () => {
      // Arrange
      const invalidData = { name: '' };

      // Act & Assert
      await expect(
        productService.create(invalidData)
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

### 7.3 Test Coverage

- **Target:** 80%+ code coverage
- **Critical paths:** 100% coverage
- **Business logic:** 90%+ coverage
- **Utilities:** 80%+ coverage

---

## Summary

These coding standards ensure:

✅ **Consistency** across the codebase  
✅ **Maintainability** for future developers  
✅ **Type safety** with TypeScript  
✅ **Error handling** best practices  
✅ **API design** following REST principles  
✅ **Database** query optimization  
✅ **Testing** standards for quality assurance  

Follow these standards to maintain code quality and team productivity.

