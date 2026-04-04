import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to get company ID
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

// Validate GSTIN format
const validateGSTIN = (gstin: string): boolean => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
};

// Validate PAN format
const validatePAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
};

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      page = '1',
      limit = '50',
      search = '',
      hasPayable = 'false',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.SupplierWhereInput = {
      companyId,
      isActive: true,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { gstin: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Payable filter
    if (hasPayable === 'true') {
      where.currentBalance = { gt: 0 };
    }

    // Sort
    const orderBy: Prisma.SupplierOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'currentBalance') {
      orderBy.currentBalance = sortOrder as 'asc' | 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
      }),
      prisma.supplier.count({ where }),
    ]);

    res.json({
      data: suppliers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch suppliers' });
  }
};

export const getSupplier = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error: any) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch supplier' });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      name,
      code,
      phone,
      email,
      whatsapp,
      gstin,
      pan,
      creditDays,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      openingBalance,
      isActive = true,
    } = req.body;

    // Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Supplier name is required (min 2 characters)' });
    }

    if (!phone || phone.trim().length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    if (gstin && !validateGSTIN(gstin)) {
      return res.status(400).json({ error: 'Invalid GSTIN format' });
    }

    if (pan && !validatePAN(pan)) {
      return res.status(400).json({ error: 'Invalid PAN format' });
    }

    // Check duplicate phone
    const existingPhone = await prisma.supplier.findFirst({
      where: {
        companyId,
        phone: phone.trim(),
        isActive: true,
      },
    });
    if (existingPhone) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }

    // Check duplicate GSTIN
    if (gstin) {
      const existingGSTIN = await prisma.supplier.findFirst({
        where: {
          companyId,
          gstin: gstin.trim(),
          isActive: true,
        },
      });
      if (existingGSTIN) {
        return res.status(400).json({ error: 'GSTIN already exists' });
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        code: code?.trim() || `SUP-${Date.now()}`,
        phone: phone.trim(),
        email: email?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        gstin: gstin?.trim() || null,
        pan: pan?.trim() || null,
        creditDays: creditDays || 0,
        addressLine1: addressLine1 || '',
        addressLine2: addressLine2 || null,
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        country: country || 'India',
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
        companyId,
        isActive,
      },
    });

    res.status(201).json(supplier);
  } catch (error: any) {
    console.error('Create supplier error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate supplier code' });
    }
    res.status(500).json({ error: error.message || 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const existing = await prisma.supplier.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const {
      name,
      code,
      phone,
      email,
      whatsapp,
      gstin,
      pan,
      creditDays,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      isActive,
    } = req.body;

    // Validation
    if (name && name.trim().length < 2) {
      return res.status(400).json({ error: 'Supplier name must be at least 2 characters' });
    }

    if (gstin && !validateGSTIN(gstin)) {
      return res.status(400).json({ error: 'Invalid GSTIN format' });
    }

    if (pan && !validatePAN(pan)) {
      return res.status(400).json({ error: 'Invalid PAN format' });
    }

    // Check duplicate phone (excluding current)
    if (phone && phone !== existing.phone) {
      const duplicate = await prisma.supplier.findFirst({
        where: {
          companyId,
          phone: phone.trim(),
          isActive: true,
          NOT: { id },
        },
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
    }

    // Check duplicate GSTIN (excluding current)
    if (gstin && gstin !== existing.gstin) {
      const duplicate = await prisma.supplier.findFirst({
        where: {
          companyId,
          gstin: gstin.trim(),
          isActive: true,
          NOT: { id },
        },
      });
      if (duplicate) {
        return res.status(400).json({ error: 'GSTIN already exists' });
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(phone && { phone: phone.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(whatsapp !== undefined && { whatsapp: whatsapp?.trim() || null }),
        ...(gstin !== undefined && { gstin: gstin?.trim() || null }),
        ...(pan !== undefined && { pan: pan?.trim() || null }),
        ...(creditDays !== undefined && { creditDays }),
        ...(addressLine1 !== undefined && { addressLine1 }),
        ...(addressLine2 !== undefined && { addressLine2: addressLine2 || null }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(pincode !== undefined && { pincode }),
        ...(country !== undefined && { country }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(supplier);
  } catch (error: any) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: error.message || 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const supplier = await prisma.supplier.findFirst({
      where: { id, companyId },
      include: {
        invoices: { take: 1 },
        payments: { take: 1 },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Check if supplier has transactions
    if (supplier.invoices.length > 0 || supplier.payments.length > 0) {
      return res.status(403).json({
        error: 'Cannot delete supplier with existing transactions',
        message: 'Please deactivate the supplier instead',
      });
    }

    await prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete supplier' });
  }
};

export const getSupplierLedger = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;
    const { fromDate, toDate } = req.query;

    const supplier = await prisma.supplier.findFirst({
      where: { id, companyId },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Build date filter
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate as string);
    }
    if (toDate) {
      dateFilter.lte = new Date(toDate as string);
    }

    // Get all invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        partyId: id,
        partyType: 'SUPPLIER',
        date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        isCancelled: false,
      },
      orderBy: { date: 'asc' },
    });

    // Get all payments
    const payments = await prisma.payment.findMany({
      where: {
        companyId,
        partyId: id,
        partyType: 'SUPPLIER',
        date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      orderBy: { date: 'asc' },
    });

    // Combine and sort by date
    const transactions: any[] = [];

    // Add opening balance
    if (Number(supplier.openingBalance) !== 0) {
      transactions.push({
        date: supplier.createdAt,
        type: 'OPENING_BALANCE',
        reference: 'Opening Balance',
        debit: Number(supplier.openingBalance) < 0 ? Math.abs(Number(supplier.openingBalance)) : 0,
        credit: Number(supplier.openingBalance) > 0 ? Number(supplier.openingBalance) : 0,
        balance: Number(supplier.openingBalance),
      });
    }

    // Add invoices (purchases - credit)
    for (const invoice of invoices) {
      const amount = Number(invoice.grandTotal);
      transactions.push({
        id: invoice.id,
        date: invoice.date,
        type: invoice.type,
        reference: invoice.invoiceNumber,
        description: `${invoice.type.replace('_', ' ')}`,
        debit: 0,
        credit: amount,
        balance: 0, // Will calculate
        paymentStatus: invoice.paymentStatus,
      });
    }

    // Add payments (debit)
    for (const payment of payments) {
      transactions.push({
        id: payment.id,
        date: payment.date,
        type: 'PAYMENT',
        reference: payment.referenceNumber || `PAY-${payment.id.slice(0, 8)}`,
        description: `Payment - ${payment.paymentMode}`,
        debit: Number(payment.amount),
        credit: 0,
        balance: 0, // Will calculate
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = Number(supplier.openingBalance);
    for (const transaction of transactions) {
      runningBalance += transaction.credit - transaction.debit;
      transaction.balance = runningBalance;
    }

    res.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        openingBalance: Number(supplier.openingBalance),
      },
      transactions,
      summary: {
        totalDebit: transactions.reduce((sum, t) => sum + t.debit, 0),
        totalCredit: transactions.reduce((sum, t) => sum + t.credit, 0),
        closingBalance: runningBalance,
      },
    });
  } catch (error: any) {
    console.error('Get supplier ledger error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch supplier ledger' });
  }
};

export const getSupplierPayable = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const supplier = await prisma.supplier.findFirst({
      where: { id, companyId },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get all unpaid invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        partyId: id,
        partyType: 'SUPPLIER',
        type: { in: ['PURCHASE_INVOICE', 'PURCHASE_RETURN'] },
        paymentStatus: { in: ['PENDING', 'PARTIAL'] },
        isCancelled: false,
      },
      include: {
        payments: true,
      },
    });

    const now = new Date();
    const current = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const overdue30 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const overdue60 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let totalPayable = 0;
    let currentPayable = 0;
    let overdue30Payable = 0;
    let overdue60Payable = 0;
    let overdue90PlusPayable = 0;

    for (const invoice of invoices) {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const payable = Number(invoice.grandTotal) - totalPaid;

      if (payable > 0) {
        totalPayable += payable;

        const invoiceDate = new Date(invoice.date);
        if (invoiceDate >= current) {
          currentPayable += payable;
        } else if (invoiceDate >= overdue30) {
          overdue30Payable += payable;
        } else if (invoiceDate >= overdue60) {
          overdue60Payable += payable;
        } else {
          overdue90PlusPayable += payable;
        }
      }
    }

    res.json({
      total: totalPayable,
      current: currentPayable,
      overdue30: overdue30Payable,
      overdue60: overdue60Payable,
      overdue90Plus: overdue90PlusPayable,
      totalOverdue: overdue30Payable + overdue60Payable + overdue90PlusPayable,
    });
  } catch (error: any) {
    console.error('Get supplier payable error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch supplier payable' });
  }
};

export const getPayableList = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId,
        isActive: true,
        currentBalance: { gt: 0 },
      },
      orderBy: { currentBalance: 'desc' },
    });

    const now = new Date();
    const overdueDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const payableList = await Promise.all(
      suppliers.map(async (supplier) => {
        // Get oldest unpaid invoice
        const oldestInvoice = await prisma.invoice.findFirst({
          where: {
            companyId,
            partyId: supplier.id,
            partyType: 'SUPPLIER',
            type: 'PURCHASE_INVOICE',
            paymentStatus: { in: ['PENDING', 'PARTIAL'] },
            isCancelled: false,
          },
          orderBy: { date: 'asc' },
        });

        const isOverdue = oldestInvoice && new Date(oldestInvoice.date) < overdueDate;

        return {
          partyId: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          payable: Number(supplier.currentBalance),
          overdue: isOverdue,
          oldestInvoiceDate: oldestInvoice?.date || null,
        };
      })
    );

    res.json(payableList);
  } catch (error: any) {
    console.error('Get payable list error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payable list' });
  }
};

