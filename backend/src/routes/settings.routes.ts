import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

const companySettingsSchema = z.object({
  moduleInvoice: z.boolean().optional(),
  moduleInventory: z.boolean().optional(),
  moduleGSTReports: z.boolean().optional(),
  modulePurchaseOrders: z.boolean().optional(),
  moduleAccounting: z.boolean().optional(),
  moduleExpense: z.boolean().optional(),
  modulePayroll: z.boolean().optional(),
  invoicePrefix: z.string().optional(),
  invoiceStartNumber: z.number().optional(),
  invoiceTemplate: z.string().optional(),
  defaultGSTRate: z.number().optional(),
  enableCGST: z.boolean().optional(),
  enableSGST: z.boolean().optional(),
  enableIGST: z.boolean().optional(),
  showCompanyLogo: z.boolean().optional(),
  showSignature: z.boolean().optional(),
  showBankDetails: z.boolean().optional(),
});

const customerGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discountPercent: z.number().default(0),
  creditLimit: z.number().default(0),
  creditDays: z.number().default(0),
  requiresAdminApproval: z.boolean().default(false),
  canCreateInvoice: z.boolean().default(true),
  alertMessage: z.string().optional(),
  color: z.string().default('blue'),
});

router.get('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;

    // FIX: Guard clause to ensure companyId is string
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }

    let settings = await prisma.companySettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: { companyId },
      });
    }

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

router.put('/settings', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;
    
    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }

    const validatedData = companySettingsSchema.parse(req.body);

    const settings = await prisma.companySettings.upsert({
      where: { companyId },
      update: validatedData,
      create: {
        companyId, // TS now knows this is string
        ...validatedData,
      },
    });

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Update settings error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

router.post('/toggle-module', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { module, enabled } = req.body;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    if (!module) {
      return res.status(400).json({ success: false, message: 'Module name is required' });
    }

    const fieldName = `module${module.charAt(0).toUpperCase() + module.slice(1)}`;
    
    const settings = await prisma.companySettings.update({
      where: { companyId },
      data: {
        [fieldName]: enabled,
      },
    });

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Toggle module error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle module' });
  }
});

router.get('/customer-groups', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    const groups = await prisma.customerGroupConfig.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: groups });
  } catch (error: any) {
    console.error('Get customer groups error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer groups' });
  }
});

router.post('/customer-groups', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;
    
    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }

    const validatedData = customerGroupSchema.parse(req.body);

    const existing = await prisma.customerGroupConfig.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: validatedData.name,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer group with this name already exists' 
      });
    }

    const group = await prisma.customerGroupConfig.create({
      data: {
        companyId, // TS now knows this is string
        name: validatedData.name,
        description: validatedData.description,
        discountPercent: validatedData.discountPercent,
        creditLimit: validatedData.creditLimit,
        creditDays: validatedData.creditDays,
        requiresAdminApproval: validatedData.requiresAdminApproval,
        canCreateInvoice: validatedData.canCreateInvoice,
        alertMessage: validatedData.alertMessage,
        color: validatedData.color,
      },
    });

    res.json({ success: true, data: group });
  } catch (error: any) {
    console.error('Create customer group error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ success: false, message: 'Failed to create customer group' });
  }
});

router.put('/customer-groups/:id', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    const existing = await prisma.customerGroupConfig.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer group not found' 
      });
    }

    if (existing.isSystem) {
      return res.status(400).json({ 
        success: false, 
        message: 'System groups cannot be modified' 
      });
    }

    const validatedData = customerGroupSchema.partial().parse(req.body);

    const group = await prisma.customerGroupConfig.update({
      where: { id },
      data: validatedData,
    });

    res.json({ success: true, data: group });
  } catch (error: any) {
    console.error('Update customer group error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ success: false, message: 'Failed to update customer group' });
  }
});

router.delete('/customer-groups/:id', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    const existing = await prisma.customerGroupConfig.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer group not found' 
      });
    }

    if (existing.isSystem) {
      return res.status(400).json({ 
        success: false, 
        message: 'System groups cannot be deleted' 
      });
    }

    await prisma.customerGroupConfig.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Customer group deleted successfully' });
  } catch (error: any) {
    console.error('Delete customer group error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete customer group' });
  }
});

router.get('/company', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        bankAccounts: {
          where: { isActive: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: 'Company not found' 
      });
    }

    res.json({ success: true, data: company });
  } catch (error: any) {
    console.error('Get company error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch company details' });
  }
});

router.put('/company', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    const {
      name,
      gstin,
      pan,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      phone,
      email,
      website,
      bankDetails,
    } = req.body;

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(name && { name }),
        ...(gstin !== undefined && { gstin }),
        ...(pan !== undefined && { pan }),
        ...(addressLine1 && { addressLine1 }),
        ...(addressLine2 !== undefined && { addressLine2 }),
        ...(city && { city }),
        ...(state && { state }),
        ...(pincode && { pincode }),
        ...(phone && { phone }),
        ...(email !== undefined && { email }),
        ...(website !== undefined && { website }),
        ...(bankDetails !== undefined && { bankDetails }),
      },
    });

    res.json({ success: true, data: company });
  } catch (error: any) {
    console.error('Update company error:', error);
    res.status(500).json({ success: false, message: 'Failed to update company profile' });
  }
});

router.post('/company/logo', authMiddleware, requireRole('ADMIN'), upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const logoPath = `/uploads/logos/${req.file.filename}`;

    await prisma.company.update({
      where: { id: companyId },
      data: { logo: logoPath },
    });

    res.json({ success: true, data: { logo: logoPath } });
  } catch (error: any) {
    console.error('Upload logo error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload logo' });
  }
});

router.post('/company/signature', authMiddleware, requireRole('ADMIN'), upload.single('signature'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const signaturePath = `/uploads/signatures/${req.file.filename}`;

    await prisma.company.update({
      where: { id: companyId },
      data: { signature: signaturePath },
    });

    res.json({ success: true, data: { signature: signaturePath } });
  } catch (error: any) {
    console.error('Upload signature error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload signature' });
  }
});

router.get('/export-config', authMiddleware, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user!;

    // FIX: Guard clause
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID is missing' });
    }
    
    const [company, settings, customerGroups] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.companySettings.findUnique({ where: { companyId } }),
      prisma.customerGroupConfig.findMany({ where: { companyId, isActive: true } }),
    ]);

    const config = {
      company,
      settings,
      customerGroups,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user!.id,
    };

    res.json({ success: true, data: config });
  } catch (error: any) {
    console.error('Export config error:', error);
    res.status(500).json({ success: false, message: 'Failed to export configuration' });
  }
});

export default router;