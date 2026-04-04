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

// Get bank accounts with filters and search
export const getBankAccounts = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      search = '',
      accountType = '',
      isActive = 'true',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build where clause
    const where: Prisma.BankAccountWhereInput = {
      companyId,
    };

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    if (accountType) {
      where.accountType = accountType as any;
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { accountNumber: { contains: search as string, mode: 'insensitive' } },
        { bankName: { contains: search as string, mode: 'insensitive' } },
        { ifscCode: { contains: search as string, mode: 'insensitive' } },
        { branchName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Get bank accounts
    const bankAccounts = await prisma.bankAccount.findMany({
      where,
      include: {
        _count: {
          select: {
            payments: true,
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc',
      },
    });

    res.json(bankAccounts);
  } catch (error: any) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bank accounts' });
  }
};

// Get single bank account
export const getBankAccount = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        payments: {
          orderBy: {
            date: 'desc',
          },
          take: 50,
        },
      },
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json(bankAccount);
  } catch (error: any) {
    console.error('Get bank account error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bank account' });
  }
};

// Create bank account
export const createBankAccount = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const {
      name,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      accountType,
      openingBalance = 0,
    } = req.body;

    // Validation
    if (!name || !accountNumber || !ifscCode || !bankName || !accountType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for duplicate account number in same company
    const existing = await prisma.bankAccount.findFirst({
      where: {
        companyId,
        accountNumber,
        isActive: true,
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Account number already exists' });
    }

    // Create bank account
    const bankAccount = await prisma.bankAccount.create({
      data: {
        name,
        accountNumber,
        ifscCode,
        bankName,
        branchName: branchName || null,
        accountType: accountType as any,
        openingBalance: Number(openingBalance),
        currentBalance: Number(openingBalance),
        companyId,
      },
    });

    res.status(201).json(bankAccount);
  } catch (error: any) {
    console.error('Create bank account error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate bank account' });
    }
    res.status(500).json({ error: error.message || 'Failed to create bank account' });
  }
};

// Update bank account
export const updateBankAccount = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const {
      name,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      accountType,
      isActive,
    } = req.body;

    // Check for duplicate account number if account number is being changed
    if (accountNumber && accountNumber !== bankAccount.accountNumber) {
      const existing = await prisma.bankAccount.findFirst({
        where: {
          companyId,
          accountNumber,
          isActive: true,
          id: { not: req.params.id },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Account number already exists' });
      }
    }

    // Update bank account
    const updated = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : undefined,
        accountNumber: accountNumber !== undefined ? accountNumber : undefined,
        ifscCode: ifscCode !== undefined ? ifscCode : undefined,
        bankName: bankName !== undefined ? bankName : undefined,
        branchName: branchName !== undefined ? branchName : undefined,
        accountType: accountType ? (accountType as any) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update bank account error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate bank account' });
    }
    res.status(500).json({ error: error.message || 'Failed to update bank account' });
  }
};

// Delete bank account (soft delete)
export const deleteBankAccount = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Check if bank account has payments
    if (bankAccount._count.payments > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete bank account with existing payments. Deactivate it instead.' 
      });
    }

    // Soft delete
    await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Bank account deleted successfully' });
  } catch (error: any) {
    console.error('Delete bank account error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete bank account' });
  }
};

// Get bank account statement
export const getBankStatement = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const { id } = req.params;
    const { fromDate, toDate, page = '1', limit = '100' } = req.query;

    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.PaymentWhereInput = {
      companyId,
      bankId: id,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) {
        where.date.gte = new Date(fromDate as string);
      }
      if (toDate) {
        where.date.lte = new Date(toDate as string);
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              type: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.payment.count({ where }),
    ]);

    // Calculate running balance
    let runningBalance = Number(bankAccount.openingBalance);
    const statement = payments.map((payment) => {
      const amount = Number(payment.amount);
      const balanceChange = payment.type === 'RECEIPT' ? amount : -amount;
      runningBalance += balanceChange;
      
      return {
        ...payment,
        balance: runningBalance,
      };
    });

    res.json({
      bankAccount: {
        id: bankAccount.id,
        name: bankAccount.name,
        accountNumber: bankAccount.accountNumber,
        openingBalance: Number(bankAccount.openingBalance),
        currentBalance: Number(bankAccount.currentBalance),
      },
      statement,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get bank statement error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bank statement' });
  }
};

// Reconcile bank account
export const reconcileBankAccount = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const { id } = req.params;
    const { balance, date, notes } = req.body;

    if (!balance || balance < 0) {
      return res.status(400).json({ error: 'Invalid balance' });
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Calculate difference
    const currentBalance = Number(bankAccount.currentBalance);
    const difference = Number(balance) - currentBalance;

    // Update bank account balance
    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        currentBalance: Number(balance),
      },
    });

    // Create reconciliation note (could be stored in a separate table)
    // For now, we'll just return the reconciliation result

    res.json({
      message: 'Bank account reconciled successfully',
      bankAccount: updated,
      reconciliation: {
        previousBalance: currentBalance,
        newBalance: Number(balance),
        difference,
        date: date ? new Date(date) : new Date(),
        notes: notes || null,
      },
    });
  } catch (error: any) {
    console.error('Reconcile bank account error:', error);
    res.status(500).json({ error: error.message || 'Failed to reconcile bank account' });
  }
};

// Get bank account summary
export const getBankSummary = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        companyId,
        isActive: true,
      },
    });

    const totalBalance = bankAccounts.reduce(
      (sum, account) => sum + Number(account.currentBalance),
      0
    );

    const cashAccount = bankAccounts.find(
      (account) => account.accountType === 'CASH'
    );

    const bankAccountsBalance = bankAccounts
      .filter((account) => account.accountType !== 'CASH')
      .reduce((sum, account) => sum + Number(account.currentBalance), 0);

    res.json({
      totalBalance,
      cashBalance: cashAccount ? Number(cashAccount.currentBalance) : 0,
      bankBalance: bankAccountsBalance,
      accountCount: bankAccounts.length,
      accounts: bankAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        accountType: account.accountType,
        balance: Number(account.currentBalance),
      })),
    });
  } catch (error: any) {
    console.error('Get bank summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bank summary' });
  }
};
