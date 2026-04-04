# GST Billing Software - Architecture Documentation

## System Architecture

### Overview

The GST Billing Software follows a **three-tier architecture** with offline-first design:

```
┌─────────────────┐
│  Desktop App    │  (Electron + React)
│  (Windows)      │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│  Cloud Backend  │  (Node.js + PostgreSQL)
│  (API Server)   │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│  Mobile App     │  (React Native)
│  (Android)      │
└─────────────────┘
```

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (Cloud), SQLite (Local - Desktop/Mobile)
- **ORM:** Prisma
- **Authentication:** JWT
- **Real-time:** WebSocket (ws)

### Desktop
- **Framework:** Electron
- **Frontend:** React 18 + TypeScript
- **UI Library:** Material-UI
- **State Management:** Redux Toolkit
- **Database:** SQLite (better-sqlite3)
- **Build Tool:** Vite
- **Charts:** Recharts

### Mobile
- **Framework:** React Native
- **Language:** TypeScript
- **UI Library:** React Native Paper
- **State Management:** Redux Toolkit
- **Database:** SQLite (react-native-sqlite-storage)
- **Navigation:** React Navigation

## Database Architecture

### Cloud Database (PostgreSQL)

**Main Tables:**
- `User` - User accounts and authentication
- `Company` - Company/business information
- `Product` - Product master data
- `Category` - Product categories
- `Customer` - Customer master
- `Supplier` - Supplier master
- `Invoice` - All invoice types (Sales, Purchase, etc.)
- `InvoiceItem` - Invoice line items
- `Payment` - Payment transactions
- `BankAccount` - Bank account details
- `StockMovement` - Stock transaction history
- `SyncLog` - Sync tracking

### Local Database (SQLite)

Desktop and Mobile apps maintain local SQLite databases with the same schema structure for offline operation.

## Sync Architecture

### Sync Flow

```
1. Local Change → Queue in SyncLog
2. Check Internet Connection
3. If Online:
   - Push changes to Cloud
   - Pull updates from Cloud
   - Resolve conflicts (latest wins)
4. Update local database
5. Mark as synced
```

### Conflict Resolution

- **Strategy:** Latest timestamp wins
- **Manual Override:** User can manually resolve conflicts
- **Conflict Detection:** Compare timestamps and data hashes

## API Architecture

### RESTful Endpoints

```
/api/auth          - Authentication
/api/users         - User management
/api/company       - Company settings
/api/products      - Product CRUD
/api/categories    - Category management
/api/customers     - Customer management
/api/suppliers     - Supplier management
/api/invoices      - Invoice operations
/api/payments      - Payment transactions
/api/banks         - Bank account management
/api/stock         - Stock operations
/api/reports       - Report generation
/api/dashboard     - Dashboard data
/api/sync          - Sync operations
/api/gst           - GST returns and reports
```

### WebSocket Events

```
connect        - Client connection
disconnect     - Client disconnection
sync-request   - Request sync
sync-data      - Sync data transfer
sync-complete  - Sync completion
error          - Error notification
```

## Security Architecture

### Authentication Flow

```
1. User login → Backend validates credentials
2. Backend generates JWT token
3. Token stored in local storage (Desktop) / Secure storage (Mobile)
4. Token sent in Authorization header for API requests
5. Backend validates token on each request
6. Token refresh before expiration
```

### Data Encryption

- **In Transit:** HTTPS/TLS
- **At Rest:** Database encryption (PostgreSQL)
- **Local Storage:** SQLite encryption (optional)
- **Sensitive Data:** Encrypted fields (passwords, tokens)

## Offline-First Design

### Local-First Strategy

1. **All operations work offline**
   - Data stored in local SQLite
   - UI remains functional
   - Operations queued for sync

2. **Background Sync**
   - Automatic sync when online
   - Manual sync trigger
   - Sync status indicator

3. **Conflict Handling**
   - Last-write-wins (default)
   - Manual conflict resolution
   - Sync logs for audit

## Module Structure

### Desktop App Modules

```
src/
├── components/      # Reusable UI components
├── pages/          # Page components
├── store/          # Redux store and slices
├── services/       # API services
├── utils/          # Utility functions
├── hooks/          # Custom React hooks
└── types/          # TypeScript types
```

### Mobile App Modules

```
src/
├── screens/        # Screen components
├── components/     # Reusable components
├── navigation/     # Navigation setup
├── store/          # Redux store
├── services/       # API services
├── utils/          # Utilities
└── types/          # TypeScript types
```

### Backend Modules

```
src/
├── controllers/     # Request handlers
├── routes/         # Route definitions
├── middleware/     # Express middleware
├── services/       # Business logic
├── utils/          # Utilities
└── types/          # TypeScript types
```

## Data Flow

### Invoice Creation Flow

```
1. User fills invoice form (Desktop/Mobile)
2. Validate data locally
3. Save to local SQLite
4. Queue for sync
5. When online:
   - Send to backend API
   - Backend validates and saves to PostgreSQL
   - Backend sends confirmation
   - Update local record with server ID
6. Update UI with success message
```

### Sync Flow

```
1. Check sync status
2. Get pending changes from local SyncLog
3. Push changes to backend
4. Backend processes and saves
5. Backend returns server-side changes
6. Pull changes and merge with local data
7. Resolve conflicts if any
8. Update sync status
```

## Performance Considerations

### Optimization Strategies

1. **Database Indexing**
   - Index on frequently queried fields
   - Composite indexes for complex queries

2. **Caching**
   - Client-side caching for static data
   - Redis caching on backend (optional)

3. **Pagination**
   - Paginated API responses
   - Virtual scrolling in UI

4. **Lazy Loading**
   - Code splitting in React
   - Lazy load routes and components

5. **Batch Operations**
   - Batch sync operations
   - Bulk import/export

## Scalability

### Horizontal Scaling

- **Load Balancer:** Multiple backend instances
- **Database:** Read replicas for reporting
- **CDN:** Static asset delivery

### Vertical Scaling

- **Database:** Optimize queries, add indexes
- **Caching:** Redis for frequently accessed data
- **Connection Pooling:** Optimize database connections

## Deployment Architecture

### Production Setup

```
┌─────────────┐
│   CDN       │  (Static assets)
└─────────────┘
       │
┌──────▼──────┐
│ Load Balancer│
└──────┬──────┘
       │
┌──────▼──────┐     ┌─────────────┐
│ Backend API │────▶│ PostgreSQL  │
│ (Multiple)  │     │ (Primary)   │
└─────────────┘     └─────────────┘
                            │
                    ┌───────▼───────┐
                    │ PostgreSQL    │
                    │ (Read Replica)│
                    └───────────────┘
```

## Monitoring & Logging

### Logging Strategy

- **Backend:** Winston or Pino
- **Desktop:** Electron log
- **Mobile:** React Native log

### Monitoring

- **Health Checks:** `/health` endpoint
- **Error Tracking:** Sentry (optional)
- **Performance:** APM tools
- **Analytics:** User behavior tracking

## Future Enhancements

1. **Microservices:** Split into smaller services
2. **Message Queue:** RabbitMQ/Kafka for async processing
3. **Caching Layer:** Redis for performance
4. **Search:** Elasticsearch for advanced search
5. **Real-time:** WebSocket for live updates
6. **Mobile Push:** Firebase Cloud Messaging

