# Sync Engine - Complete Implementation Guide

## Overview

The sync engine enables offline-first operation by synchronizing data between:
- **Desktop App** (SQLite) ↔ **Cloud Server** (PostgreSQL)
- **Mobile App** (SQLite) ↔ **Cloud Server** (PostgreSQL)

## Architecture

```
┌─────────────────────────────────────┐
│   Local Device (Desktop/Mobile)     │
│   SQLite Database                   │
│   - All operations work offline     │
│   - Changes queued for sync         │
│   - synced = false for new changes  │
└──────────────┬──────────────────────┘
               │
               │ HTTP REST API
               │ WebSocket (optional)
               │
┌──────────────▼──────────────────────┐
│   Cloud Server (PostgreSQL)          │
│   - Central data store              │
│   - Conflict resolution              │
│   - Multi-device sync                │
└─────────────────────────────────────┘
```

## Sync Flow

### 1. Local Change Detection

When a user creates/updates/deletes a record locally:

```typescript
// Create product locally
const product = await localDB.products.create({
  id: generateUUID(),
  name: 'New Product',
  synced: false,  // Mark as unsynced
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

### 2. Queue for Sync

Add to sync queue:

```typescript
await localDB.syncQueue.create({
  entity: 'products',
  action: 'create',
  localId: product.id,
  data: product,
  timestamp: new Date(),
  status: 'pending',
});
```

### 3. Upload Changes (Push)

When device comes online:

```typescript
// Get all unsynced changes
const pendingChanges = await localDB.syncQueue.findMany({
  where: { status: 'pending' },
  orderBy: { timestamp: 'asc' }
});

// Group by entity type
const changes = {
  products: [],
  invoices: [],
  payments: [],
  // ...
};

pendingChanges.forEach(item => {
  changes[item.entity].push({
    id: item.localId,
    action: item.action,
    data: item.data,
    timestamp: item.timestamp
  });
});

// Upload to server
const response = await api.post('/api/sync/upload', {
  deviceId: getDeviceId(),
  lastSyncTime: lastSyncTime,
  changes: changes
});
```

### 4. Download Updates (Pull)

Fetch updates from server:

```typescript
const response = await api.get('/api/sync/download', {
  params: {
    lastSyncTime: lastSyncTime,
    deviceId: getDeviceId()
  }
});

// Apply updates to local database
for (const entityType of Object.keys(response.data.updates)) {
  const updates = response.data.updates[entityType];
  
  for (const update of updates) {
    // Check if record exists locally
    const existing = await localDB[entityType].findOne({
      where: { id: update.id }
    });

    if (existing) {
      // Update existing
      await localDB[entityType].update({
        where: { id: update.id },
        data: {
          ...update,
          synced: true,
          syncedAt: new Date()
        }
      });
    } else {
      // Insert new
      await localDB[entityType].create({
        ...update,
        synced: true,
        syncedAt: new Date()
      });
    }
  }
}
```

### 5. Conflict Resolution

**Detection:**
```typescript
// Compare timestamps
if (localRecord.updatedAt > cloudRecord.updatedAt) {
  // Local is newer - use local
  resolution = 'local';
} else if (cloudRecord.updatedAt > localRecord.updatedAt) {
  // Cloud is newer - use cloud
  resolution = 'cloud';
} else {
  // Same timestamp - manual resolution needed
  resolution = 'manual';
}
```

**Resolution Strategies:**

1. **Last Write Wins (Default)**
   - Compare `updatedAt` timestamps
   - Most recent change wins
   - Automatic resolution

2. **Manual Resolution**
   - Show conflict to user
   - User chooses: local, cloud, or merge
   - Store resolution preference

3. **Merge Strategy**
   - Combine non-conflicting fields
   - User resolves conflicting fields
   - Create merged record

## API Endpoints

### POST /api/sync/upload

**Request:**
```json
{
  "deviceId": "device-uuid",
  "lastSyncTime": "2024-01-01T00:00:00Z",
  "changes": {
    "products": [
      {
        "id": "local-uuid",
        "action": "create",
        "data": {
          "name": "Product 1",
          "code": "P001",
          "salePrice": 100
        },
        "timestamp": "2024-01-01T00:00:00Z"
      }
    ],
    "invoices": [ ... ],
    "payments": [ ... ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "created": [
      {
        "entityType": "products",
        "localId": "local-uuid",
        "serverId": "server-uuid"
      }
    ],
    "updated": [ ... ],
    "errors": [ ... ]
  },
  "syncedAt": "2024-01-01T00:00:00Z"
}
```

### GET /api/sync/download

**Query Parameters:**
- `lastSyncTime`: ISO timestamp of last successful sync
- `deviceId`: Unique device identifier

**Response:**
```json
{
  "success": true,
  "lastSyncTime": "2024-01-01T00:00:00Z",
  "updates": {
    "products": [ ... ],
    "invoices": [ ... ],
    "payments": [ ... ]
  },
  "conflicts": [
    {
      "entityType": "products",
      "entityId": "uuid",
      "localData": { ... },
      "cloudData": { ... },
      "localTimestamp": "2024-01-01T00:00:00Z",
      "cloudTimestamp": "2024-01-01T01:00:00Z"
    }
  ],
  "summary": {
    "totalRecords": 150,
    "conflictsCount": 2
  }
}
```

### GET /api/sync/status

**Response:**
```json
{
  "lastSyncTime": "2024-01-01T00:00:00Z",
  "isSyncing": false,
  "pendingChanges": 5,
  "pendingCounts": {
    "products": 2,
    "invoices": 2,
    "payments": 1
  },
  "deviceId": "device-uuid"
}
```

### POST /api/sync/resolve-conflict

**Request:**
```json
{
  "entityType": "products",
  "entityId": "uuid",
  "resolution": "local|cloud|merge",
  "localData": { ... },
  "cloudData": { ... }
}
```

## Implementation Details

### Device ID Generation

```typescript
// Generate unique device ID on first launch
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}
```

### Sync Queue Management

```typescript
interface SyncQueueItem {
  id: string;
  entity: string;
  action: 'create' | 'update' | 'delete';
  localId: string;
  serverId?: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
}
```

### Batch Processing

```typescript
// Process in batches of 50
const BATCH_SIZE = 50;

async function processSyncQueue() {
  const pending = await getPendingItems();
  
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    await uploadBatch(batch);
  }
}
```

### Retry Logic

```typescript
const MAX_RETRIES = 3;

async function uploadWithRetry(item: SyncQueueItem) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await uploadItem(item);
      item.status = 'synced';
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        item.status = 'failed';
        item.error = error.message;
      } else {
        await delay(attempt * 1000); // Exponential backoff
      }
    }
  }
}
```

## Conflict Resolution Examples

### Example 1: Both Updated

**Scenario:**
- Local: Product price updated to ₹100 at 10:00 AM
- Cloud: Product price updated to ₹120 at 11:00 AM

**Resolution:**
- Cloud timestamp is newer → Use cloud value (₹120)
- Update local database with cloud data

### Example 2: Local Deleted, Cloud Updated

**Scenario:**
- Local: Product deleted at 10:00 AM
- Cloud: Product updated at 11:00 AM

**Resolution:**
- Cloud timestamp is newer → Restore product with cloud data
- Mark as active in local database

### Example 3: New Records on Both Sides

**Scenario:**
- Local: Created Product A (UUID: local-1)
- Cloud: Created Product B (UUID: cloud-1)

**Resolution:**
- Both are new → Keep both
- Map local UUID to server UUID
- Update local record with server UUID

## Performance Optimization

### 1. Incremental Sync

Only sync changed records:
```typescript
const updates = await prisma.product.findMany({
  where: {
    companyId,
    updatedAt: { gt: lastSyncTime }
  }
});
```

### 2. Compression

Compress large payloads:
```typescript
import { gzip } from 'zlib';

const compressed = await gzip(JSON.stringify(data));
```

### 3. Parallel Processing

Process multiple entities in parallel:
```typescript
await Promise.all([
  syncProducts(),
  syncInvoices(),
  syncPayments(),
]);
```

### 4. Background Sync

Sync in background without blocking UI:
```typescript
// Use Web Worker or background task
setInterval(async () => {
  if (isOnline()) {
    await performSync();
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

## Error Handling

### Network Errors

```typescript
try {
  await uploadSync();
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Queue for retry
    await queueForRetry();
  } else {
    // Log error
    logger.error('Sync error:', error);
  }
}
```

### Data Validation Errors

```typescript
try {
  await uploadSync();
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Mark item as failed
    item.status = 'failed';
    item.error = error.message;
    // Notify user
    showError('Sync failed: Invalid data');
  }
}
```

## Testing Sync Engine

### Unit Tests

```typescript
describe('Sync Engine', () => {
  it('should upload local changes', async () => {
    const changes = { products: [mockProduct] };
    const result = await syncEngine.upload(changes);
    expect(result.success).toBe(true);
  });

  it('should download cloud updates', async () => {
    const updates = await syncEngine.download(lastSyncTime);
    expect(updates.products.length).toBeGreaterThan(0);
  });

  it('should resolve conflicts', async () => {
    const conflict = {
      local: { updatedAt: new Date('2024-01-01') },
      cloud: { updatedAt: new Date('2024-01-02') }
    };
    const resolution = await syncEngine.resolveConflict(conflict);
    expect(resolution).toBe('cloud');
  });
});
```

### Integration Tests

```typescript
describe('Sync Integration', () => {
  it('should sync product across devices', async () => {
    // Create product on device 1
    const product = await device1.createProduct({ name: 'Test' });
    
    // Sync device 1
    await device1.sync();
    
    // Sync device 2
    await device2.sync();
    
    // Verify product on device 2
    const synced = await device2.getProduct(product.id);
    expect(synced.name).toBe('Test');
  });
});
```

## Monitoring & Logging

### Sync Metrics

Track:
- Sync frequency
- Success rate
- Conflict rate
- Data transfer size
- Sync duration

### Logging

```typescript
logger.info('Sync started', {
  deviceId,
  pendingChanges: 10,
  timestamp: new Date()
});

logger.info('Sync completed', {
  deviceId,
  synced: 10,
  failed: 0,
  duration: 1500, // ms
});
```

## Best Practices

1. **Always sync in background** - Don't block UI
2. **Batch operations** - Group changes for efficiency
3. **Handle errors gracefully** - Queue for retry
4. **Show sync status** - Keep user informed
5. **Resolve conflicts quickly** - Don't let them accumulate
6. **Optimize data transfer** - Only sync changed fields
7. **Test thoroughly** - Sync is critical functionality

---

## Summary

The sync engine provides:

✅ **Offline-first operation** - Work without internet  
✅ **Automatic sync** - When connection available  
✅ **Conflict resolution** - Handle data conflicts  
✅ **Efficient transfer** - Only sync changes  
✅ **Error handling** - Retry failed operations  
✅ **Status tracking** - Monitor sync progress  

This enables a seamless experience across desktop and mobile devices while maintaining data consistency.

