// src/controllers/customers.ts
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

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      page = '1',
      limit = '50',
      search = '',
      group = '',
      isBlacklisted,
      isDefaulter,
      hasOutstanding = 'false',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.CustomerWhereInput = {
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

    // Group filter
    if (group) {
      where.group = group as any;
    }

    // Blacklist filter
    if (isBlacklisted !== undefined) {
      where.isBlacklisted = isBlacklisted === 'true';
    }

    // Defaulter filter
    if (isDefaulter !== undefined) {
      where.isDefaulter = isDefaulter === 'true';
    }

    // Outstanding filter
    if (hasOutstanding === 'true') {
      where.outstandingAmount = { gt: 0 };
    }

    // Sort
    const orderBy: Prisma.CustomerOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'outstandingAmount') {
      orderBy.outstandingAmount = sortOrder as 'asc' | 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      data: customers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customers' });
  }
};

export const getCustomer = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const customer = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error: any) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer' });
  }
};

export const createCustomer = async (req: Request, res: Response) => {
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
      group,
      creditLimit,
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
      return res.status(400).json({ error: 'Customer name is required (min 2 characters)' });
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
    const existingPhone = await prisma.customer.findFirst({
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
      const existingGSTIN = await prisma.customer.findFirst({
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

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        code: code?.trim() || `CUST-${Date.now()}`,
        phone: phone.trim(),
        email: email?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        gstin: gstin?.trim() || null,
        pan: pan?.trim() || null,
        group: group || 'RETAIL',
        creditLimit: creditLimit || 0,
        creditDays: creditDays || 0,
        addressLine1: addressLine1 || '',
        addressLine2: addressLine2 || null,
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        country: country || 'India',
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
        outstandingAmount: 0,
        companyId,
        isActive,
      },
    });

    res.status(201).json(customer);
  } catch (error: any) {
    console.error('Create customer error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate customer code' });
    }
    res.status(500).json({ error: error.message || 'Failed to create customer' });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const existing = await prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const {
      name,
      code,
      phone,
      email,
      whatsapp,
      gstin,
      pan,
      group,
      creditLimit,
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
      return res.status(400).json({ error: 'Customer name must be at least 2 characters' });
    }

    if (gstin && !validateGSTIN(gstin)) {
      return res.status(400).json({ error: 'Invalid GSTIN format' });
    }

    if (pan && !validatePAN(pan)) {
      return res.status(400).json({ error: 'Invalid PAN format' });
    }

    // Check duplicate phone (excluding current)
    if (phone && phone !== existing.phone) {
      const duplicate = await prisma.customer.findFirst({
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
      const duplicate = await prisma.customer.findFirst({
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

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(phone && { phone: phone.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(whatsapp !== undefined && { whatsapp: whatsapp?.trim() || null }),
        ...(gstin !== undefined && { gstin: gstin?.trim() || null }),
        ...(pan !== undefined && { pan: pan?.trim() || null }),
        ...(group && { group }),
        ...(creditLimit !== undefined && { creditLimit }),
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

    res.json(customer);
  } catch (error: any) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to update customer' });
  }
};

// FIXED: This was the problematic function
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // ✅ FIXED: Check for invoices and payments separately (no include needed)
    const [invoiceCount, paymentCount] = await Promise.all([
      prisma.invoice.count({
        where: {
          partyId: id,
          partyType: 'CUSTOMER',
          isCancelled: false,
        },
      }),
      prisma.payment.count({
        where: {
          partyId: id,
          partyType: 'CUSTOMER',
        },
      }),
    ]);

    // Check if customer has transactions
    if (invoiceCount > 0 || paymentCount > 0) {
      return res.status(403).json({
        error: 'Cannot delete customer with existing transactions',
        message: 'Please deactivate the customer instead',
        invoiceCount,
        paymentCount,
      });
    }

    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Customer deleted successfully' });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete customer' });
  }
};

// NEW: Blacklist Management
export const blacklistCustomer = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;
    const { reason } = req.body;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isBlacklisted: true,
        blacklistReason: reason || 'No reason provided',
        blacklistedAt: new Date(),
        blacklistedBy: req.user!.id,
        group: 'BLACKLIST',
      },
    });

    res.json({ message: 'Customer blacklisted successfully', data: customer });
  } catch (error: any) {
    console.error('Blacklist customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to blacklist customer' });
  }
};

export const unblacklistCustomer = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isBlacklisted: false,
        blacklistReason: null,
        blacklistedAt: null,
        blacklistedBy: null,
        group: 'RETAIL',
      },
    });

    res.json({ message: 'Customer removed from blacklist', data: customer });
  } catch (error: any) {
    console.error('Unblacklist customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove customer from blacklist' });
  }
};

export const markDefaulter = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isDefaulter: true,
        group: 'DEFAULTER',
      },
    });

    res.json({ message: 'Customer marked as defaulter', data: customer });
  } catch (error: any) {
    console.error('Mark defaulter error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark customer as defaulter' });
  }
};

export const clearDefaulter = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isDefaulter: false,
        group: 'RETAIL',
      },
    });

    res.json({ message: 'Defaulter status cleared', data: customer });
  } catch (error: any) {
    console.error('Clear defaulter error:', error);
    res.status(500).json({ error: error.message || 'Failed to clear defaulter status' });
  }
};

export const canBillCustomer = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;
    const userRole = req.user!.role;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if blacklisted
    if (customer.isBlacklisted) {
      if (userRole === 'ADMIN') {
        return res.json({
          canBill: true,
          warning: 'Customer is blacklisted. Admin override applied.',
          requiresApproval: false,
        });
      }
      return res.json({
        canBill: false,
        message: customer.blacklistReason || 'Customer is blacklisted. Admin approval required.',
        requiresApproval: true,
      });
    }

    // Check if defaulter
    if (customer.isDefaulter) {
      if (userRole === 'ADMIN') {
        return res.json({
          canBill: true,
          warning: 'Customer is marked as defaulter. Admin override applied.',
          requiresApproval: false,
        });
      }
      return res.json({
        canBill: false,
        message: 'Customer has defaulted on payments. Admin approval required.',
        requiresApproval: true,
      });
    }

    // Check credit limit
    if (Number(customer.outstandingAmount) >= Number(customer.creditLimit) && Number(customer.creditLimit) > 0) {
      return res.json({
        canBill: false,
        message: `Customer has exceeded credit limit of ₹${customer.creditLimit}`,
        requiresApproval: true,
      });
    }

    res.json({
      canBill: true,
      message: 'Customer can be billed',
      requiresApproval: false,
    });
  } catch (error: any) {
    console.error('Can bill check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check billing permission' });
  }
};

export const getCustomerStats = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get invoice statistics
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        partyId: id,
        partyType: 'CUSTOMER',
        isCancelled: false,
      },
      select: {
        grandTotal: true,
        paymentStatus: true,
        date: true,
      },
    });

    const totalInvoices = invoices.length;
    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
    const pendingInvoices = invoices.filter(
      inv => inv.paymentStatus === 'PENDING' || inv.paymentStatus === 'PARTIAL'
    ).length;

    // Get payment statistics
    const payments = await prisma.payment.findMany({
      where: {
        companyId,
        partyId: id,
        partyType: 'CUSTOMER',
        type: 'RECEIPT',
      },
      select: {
        amount: true,
      },
    });

    const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const outstandingAmount = totalSales - totalPaid;

    // Update customer outstanding amount
    await prisma.customer.update({
      where: { id },
      data: {
        totalInvoices,
        totalPaid,
        outstandingAmount,
        lastInvoiceDate: invoices.length > 0 ? invoices[invoices.length - 1].date : null,
      },
    });

    res.json({
      totalInvoices,
      totalSales,
      totalPaid,
      outstandingAmount,
      pendingInvoices,
      creditLimit: Number(customer.creditLimit),
      creditAvailable: Math.max(0, Number(customer.creditLimit) - outstandingAmount),
    });
  } catch (error: any) {
    console.error('Get customer stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer statistics' });
  }
};

export const getCustomerLedger = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;
    const { fromDate, toDate } = req.query;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
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
        partyType: 'CUSTOMER',
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        isCancelled: false,
      },
      orderBy: { date: 'asc' },
    });

    // Get all payments
    const payments = await prisma.payment.findMany({
      where: {
        companyId,
        partyId: id,
        partyType: 'CUSTOMER',
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      orderBy: { date: 'asc' },
    });

    // Combine and sort by date
    const transactions: any[] = [];

    // Add opening balance
    if (Number(customer.openingBalance) !== 0) {
      transactions.push({
        date: customer.createdAt,
        type: 'OPENING_BALANCE',
        reference: 'Opening Balance',
        debit: Number(customer.openingBalance) > 0 ? Number(customer.openingBalance) : 0,
        credit: Number(customer.openingBalance) < 0 ? Math.abs(Number(customer.openingBalance)) : 0,
        balance: Number(customer.openingBalance),
      });
    }

    // Add invoices
    for (const invoice of invoices) {
      const amount = Number(invoice.grandTotal);
      transactions.push({
        id: invoice.id,
        date: invoice.date,
        type: invoice.type,
        reference: invoice.invoiceNumber,
        description: `${invoice.type.replace('_', ' ')}`,
        debit: amount,
        credit: 0,
        balance: 0,
        paymentStatus: invoice.paymentStatus,
      });
    }

    // Add payments
    for (const payment of payments) {
      transactions.push({
        id: payment.id,
        date: payment.date,
        type: 'PAYMENT',
        reference: payment.referenceNumber || `PAY-${payment.id.slice(0, 8)}`,
        description: `Payment - ${payment.paymentMode}`,
        debit: 0,
        credit: Number(payment.amount),
        balance: 0,
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = Number(customer.openingBalance);
    for (const transaction of transactions) {
      runningBalance += transaction.debit - transaction.credit;
      transaction.balance = runningBalance;
    }

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        openingBalance: Number(customer.openingBalance),
      },
      transactions,
      summary: {
        totalDebit: transactions.reduce((sum, t) => sum + t.debit, 0),
        totalCredit: transactions.reduce((sum, t) => sum + t.credit, 0),
        closingBalance: runningBalance,
      },
    });
  } catch (error: any) {
    console.error('Get customer ledger error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer ledger' });
  }
};