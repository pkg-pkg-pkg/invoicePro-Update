import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Get company ID from user
const getUserCompanyId = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true }
  });
  if (!user || !user.companyId) {
    throw new Error('User company not found');
  }
  return user.companyId;
};

// Upload local changes to cloud
export const uploadSync = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { deviceId, lastSyncTime, changes } = req.body;

    if (!deviceId || !changes) {
      return res.status(400).json({ error: 'Missing required fields: deviceId, changes' });
    }

    const results: Record<string, any[]> = {
      created: [],
      updated: [],
      errors: []
    };

    // Process each entity type
    for (const [entityType, entityChanges] of Object.entries(changes)) {
      if (!Array.isArray(entityChanges)) continue;

      for (const change of entityChanges) {
        try {
          const { id, action, data, timestamp } = change;

          if (action === 'create') {
            // Create new record
            const result = await createEntity(entityType, { ...data, companyId });
            results.created.push({ entityType, localId: id, serverId: result.id });
          } else if (action === 'update') {
            // Update existing record
            const serverId = data.serverId || id;
            await updateEntity(entityType, serverId, data, companyId);
            results.updated.push({ entityType, id: serverId });
          } else if (action === 'delete') {
            // Soft delete record
            const serverId = data.serverId || id;
            await deleteEntity(entityType, serverId, companyId);
            results.updated.push({ entityType, id: serverId, action: 'deleted' });
          }
        } catch (error: any) {
          results.errors.push({
            entityType,
            id: change.id,
            error: error.message
          });
        }
      }
    }

    // Log sync
    await prisma.syncLog.create({
      data: {
        deviceId,
        entity: 'sync',
        action: 'upload',
        data: { results },
        companyId,
        userId: req.user!.id,
        timestamp: new Date(),
      }
    });

    res.json({
      success: true,
      results,
      syncedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Upload sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload sync data' });
  }
};

// Download cloud updates
export const downloadSync = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { lastSyncTime, deviceId } = req.query;

    const since = lastSyncTime ? new Date(lastSyncTime as string) : new Date(0);

    // Get all updated records since last sync
    const updates: Record<string, any[]> = {
      products: [],
      customers: [],
      suppliers: [],
      invoices: [],
      payments: [],
      bankAccounts: [],
    };

    // Fetch products
    const products = await prisma.product.findMany({
      where: {
        companyId,
        OR: [
          { updatedAt: { gt: since } },
          { createdAt: { gt: since } }
        ],
        // deletedAt: null // Field not in schema
      }
    });
    updates.products = products.map(p => ({
      ...p,
      syncedAt: new Date().toISOString()
    }));

    // Fetch customers
    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { updatedAt: { gt: since } },
          { createdAt: { gt: since } }
        ],
        // deletedAt: null // Field not in schema
      }
    });
    updates.customers = customers.map(c => ({
      ...c,
      syncedAt: new Date().toISOString()
    }));

    // Fetch suppliers
    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId,
        OR: [
          { updatedAt: { gt: since } },
          { createdAt: { gt: since } }
        ],
        // deletedAt: null // Field not in schema
      }
    });
    updates.suppliers = suppliers.map(s => ({
      ...s,
      syncedAt: new Date().toISOString()
    }));

    // Fetch invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        OR: [
          { updatedAt: { gt: since } },
          { createdAt: { gt: since } }
        ],
        // deletedAt: null // Field not in schema
      },
      include: {
        items: true
      },
      take: 1000 // Limit for performance
    });
    updates.invoices = invoices.map(i => ({
      ...i,
      syncedAt: new Date().toISOString()
    }));

    // Fetch payments
    const payments = await prisma.payment.findMany({
      where: {
        companyId,
        OR: [
          { updatedAt: { gt: since } },
          { createdAt: { gt: since } }
        ],
        // deletedAt: null // Field not in schema
      },
      take: 1000
    });
    updates.payments = payments.map(p => ({
      ...p,
      syncedAt: new Date().toISOString()
    }));

    // Fetch bank accounts
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        companyId,
        OR: [
          { updatedAt: { gt: since } },
          { createdAt: { gt: since } }
        ],
        isActive: true
      }
    });
    updates.bankAccounts = bankAccounts.map(b => ({
      ...b,
      syncedAt: new Date().toISOString()
    }));

    // Check for conflicts (records updated on both sides)
    const conflicts: any[] = []; // TODO: Implement conflict detection

    // Log sync
    if (deviceId) {
      await prisma.syncLog.create({
        data: {
          deviceId: deviceId as string,
          entity: 'sync',
          action: 'download',
          data: {
            recordCounts: {
              products: updates.products.length,
              customers: updates.customers.length,
              suppliers: updates.suppliers.length,
              invoices: updates.invoices.length,
              payments: updates.payments.length,
              bankAccounts: updates.bankAccounts.length,
            }
          },
          companyId,
          userId: req.user!.id,
          timestamp: new Date(),
        }
      });
    }

    res.json({
      success: true,
      lastSyncTime: new Date().toISOString(),
      updates,
      conflicts,
      summary: {
        totalRecords: Object.values(updates).reduce((sum, arr) => sum + arr.length, 0),
        conflictsCount: conflicts.length
      }
    });
  } catch (error: any) {
    console.error('Download sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to download sync data' });
  }
};

// Get sync status
export const getSyncStatus = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Get last sync time
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        deviceId: deviceId as string,
        companyId,
        syncedAt: { not: null }
      },
      orderBy: {
        syncedAt: 'desc'
      }
    });

    // Count pending changes (records not synced)
    const pendingCounts = {
      products: await prisma.product.count({
        where: {
          companyId,
          // syncedAt: null, // Field not in schema
          // deletedAt: null // Field not in schema
        }
      }),
      customers: await prisma.customer.count({
        where: {
          companyId,
          // syncedAt: null, // Field not in schema
          // deletedAt: null // Field not in schema
        }
      }),
      invoices: await prisma.invoice.count({
        where: {
          companyId,
          // syncedAt: null, // Field not in schema
          // deletedAt: null // Field not in schema
        }
      }),
      payments: await prisma.payment.count({
        where: {
          companyId,
          // syncedAt: null, // Field not in schema
          // deletedAt: null // Field not in schema
        }
      }),
    };

    const totalPending = Object.values(pendingCounts).reduce((sum, count) => sum + count, 0);

    res.json({
      lastSyncTime: lastSync?.syncedAt?.toISOString() || null,
      isSyncing: false, // TODO: Track active sync operations
      pendingChanges: totalPending,
      pendingCounts,
      deviceId: deviceId as string
    });
  } catch (error: any) {
    console.error('Get sync status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get sync status' });
  }
};

// Resolve conflict
export const resolveConflict = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { entityType, entityId, resolution, localData, cloudData } = req.body;

    // Resolution: 'local' | 'cloud' | 'merge'
    if (resolution === 'local') {
      // Use local data
      await updateEntity(entityType, entityId, localData, companyId);
    } else if (resolution === 'cloud') {
      // Use cloud data (no action needed, already in cloud)
      // Just update local sync status
    } else if (resolution === 'merge') {
      // Merge data (use cloud data with local overrides)
      const merged = { ...cloudData, ...localData };
      await updateEntity(entityType, entityId, merged, companyId);
    }

    res.json({
      success: true,
      message: 'Conflict resolved',
      resolvedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Resolve conflict error:', error);
    res.status(500).json({ error: error.message || 'Failed to resolve conflict' });
  }
};

// Get sync history
export const getSyncHistory = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { deviceId, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.SyncLogWhereInput = {
      companyId,
    };

    if (deviceId) {
      where.deviceId = deviceId as string;
    }

    const [logs, total] = await Promise.all([
      prisma.syncLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.syncLog.count({ where })
    ]);

    res.json({
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error: any) {
    console.error('Get sync history error:', error);
    res.status(500).json({ error: error.message || 'Failed to get sync history' });
  }
};

// Helper functions
async function createEntity(entityType: string, data: any) {
  switch (entityType) {
    case 'products':
      return await prisma.product.create({ data });
    case 'customers':
      return await prisma.customer.create({ data });
    case 'suppliers':
      return await prisma.supplier.create({ data });
    case 'invoices':
      const { items, ...invoiceData } = data;
      const invoice = await prisma.invoice.create({ data: invoiceData });
      if (items && items.length > 0) {
        await prisma.invoiceItem.createMany({
          data: items.map((item: any) => ({ ...item, invoiceId: invoice.id }))
        });
      }
      return invoice;
    case 'payments':
      return await prisma.payment.create({ data });
    case 'bankAccounts':
      return await prisma.bankAccount.create({ data });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

async function updateEntity(entityType: string, id: string, data: any, companyId: string) {
  const updateData = { ...data, updatedAt: new Date() };
  delete updateData.id;
  delete updateData.companyId;

  switch (entityType) {
    case 'products':
      return await prisma.product.update({
        where: { id, companyId },
        data: updateData
      });
    case 'customers':
      return await prisma.customer.update({
        where: { id, companyId },
        data: updateData
      });
    case 'suppliers':
      return await prisma.supplier.update({
        where: { id, companyId },
        data: updateData
      });
    case 'invoices':
      return await prisma.invoice.update({
        where: { id, companyId },
        data: updateData
      });
    case 'payments':
      return await prisma.payment.update({
        where: { id, companyId },
        data: updateData
      });
    case 'bankAccounts':
      return await prisma.bankAccount.update({
        where: { id, companyId },
        data: updateData
      });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

async function deleteEntity(entityType: string, id: string, companyId: string) {
  const deleteData = {
    isActive: false,
    deletedAt: new Date(),
    updatedAt: new Date()
  };

  switch (entityType) {
    case 'products':
      return await prisma.product.update({
        where: { id, companyId },
        data: deleteData
      });
    case 'customers':
      return await prisma.customer.update({
        where: { id, companyId },
        data: deleteData
      });
    case 'suppliers':
      return await prisma.supplier.update({
        where: { id, companyId },
        data: deleteData
      });
    case 'invoices':
      return await prisma.invoice.update({
        where: { id, companyId },
        data: { ...deleteData, isCancelled: true, cancelledAt: new Date() }
      });
    case 'payments':
      return await prisma.payment.update({
        where: { id, companyId },
        data: deleteData
      });
    case 'bankAccounts':
      return await prisma.bankAccount.update({
        where: { id, companyId },
        data: { ...deleteData, isActive: false }
      });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}
