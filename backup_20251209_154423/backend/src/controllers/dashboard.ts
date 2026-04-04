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

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { period = 'today' } = req.query;

    // Calculate date range based on period
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate = today;
    if (period === 'week') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
    } else if (period === 'year') {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
    }

    // Sales invoices
    const salesInvoices = await prisma.invoice.aggregate({
      where: {
        companyId,
        type: 'SALES_INVOICE',
        date: { gte: startDate },
        isCancelled: false
      },
      _sum: { 
        grandTotal: true,
        totalTax: true,
        subtotal: true
      },
      _count: true
    });
    
    // Purchase invoices
    const purchaseInvoices = await prisma.invoice.aggregate({
      where: {
        companyId,
        type: 'PURCHASE_INVOICE',
        date: { gte: startDate },
        isCancelled: false
      },
      _sum: { 
        grandTotal: true,
        totalTax: true
      },
      _count: true
    });

    // Cash balance
    const cashAccount = await prisma.bankAccount.findFirst({
      where: { 
        companyId,
        accountType: 'CASH',
        isActive: true
      }
    });
    
    // Bank balance
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { 
        companyId,
        accountType: { in: ['SAVINGS', 'CURRENT'] },
        isActive: true
      }
    });
    const bankBalance = bankAccounts.reduce((sum, acc) => 
      sum + Number(acc.currentBalance), 0
    );
    
    // Outstanding (positive balances = receivables)
    const outstanding = await prisma.customer.aggregate({
      where: {
        companyId,
        isActive: true,
        currentBalance: { gt: 0 }
      },
      _sum: { currentBalance: true },
      _count: true
    });
    
    // Payable (positive balances = payables)
    const payable = await prisma.supplier.aggregate({
      where: {
        companyId,
        isActive: true,
        currentBalance: { gt: 0 }
      },
      _sum: { currentBalance: true },
      _count: true
    });

    // Calculate overdue (invoices with payment status PENDING or PARTIAL older than credit days)
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: 'SALES_INVOICE',
        paymentStatus: { in: ['PENDING', 'PARTIAL'] },
        isCancelled: false,
        date: {
          lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        }
      },
      select: {
        grandTotal: true,
        date: true
      }
    });

    const overdueAmount = overdueInvoices.reduce((sum, inv) => {
      const paid = 0; // TODO: Calculate paid amount from payments
      return sum + (Number(inv.grandTotal) - paid);
    }, 0);

    const totalSales = Number(salesInvoices._sum.grandTotal || 0);
    const totalPurchase = Number(purchaseInvoices._sum.grandTotal || 0);
    
    res.json({
      totalSales,
      totalPurchase,
      salesCount: salesInvoices._count,
      purchaseCount: purchaseInvoices._count,
      totalTax: Number(salesInvoices._sum.totalTax || 0),
      cashInHand: Number(cashAccount?.currentBalance || 0),
      bankBalance,
      totalBalance: Number(cashAccount?.currentBalance || 0) + bankBalance,
      profitLoss: totalSales - totalPurchase,
      totalOutstanding: Number(outstanding._sum.currentBalance || 0),
      outstandingCount: outstanding._count,
      totalPayable: Number(payable._sum.currentBalance || 0),
      payableCount: payable._count,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      period
    });
  } catch (error: any) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch dashboard summary' });
  }
};

export const getSalesAnalytics = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { period = 'month', groupBy = 'day' } = req.query;

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    if (period === 'week') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(endDate.getFullYear() - 1);
    } else {
      startDate.setDate(endDate.getDate() - 30); // Default 30 days
    }
    startDate.setHours(0, 0, 0, 0);

    // Get sales invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: 'SALES_INVOICE',
        date: {
          gte: startDate,
          lte: endDate
        },
        isCancelled: false
      },
      select: {
        date: true,
        grandTotal: true,
        subtotal: true,
        totalTax: true,
        items: {
          select: {
            productId: true,
            product: {
              select: {
                name: true
              }
            },
            quantity: true,
            totalAmount: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Group by day/week/month
    const grouped: Record<string, {
      date: string;
      sales: number;
      count: number;
      tax: number;
    }> = {};

    invoices.forEach(invoice => {
      const date = new Date(invoice.date);
      let key = '';
      
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          sales: 0,
          count: 0,
          tax: 0
        };
      }

      grouped[key].sales += Number(invoice.grandTotal);
      grouped[key].count += 1;
      grouped[key].tax += Number(invoice.totalTax);
    });

    // Convert to array and sort
    const analytics = Object.values(grouped).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Top products
    const productSales: Record<string, {
      productId: string;
      productName: string;
      quantity: number;
      amount: number;
    }> = {};

    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (item.productId) {
          const productId = item.productId;
          if (!productSales[productId]) {
            productSales[productId] = {
              productId,
              productName: item.product?.name || 'Unknown',
              quantity: 0,
              amount: 0
            };
          }
          productSales[productId].quantity += Number(item.quantity);
          productSales[productId].amount += Number(item.totalAmount);
        }
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    res.json({
      analytics,
      topProducts,
      totalSales: invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
      totalCount: invoices.length,
      period,
      groupBy
    });
  } catch (error: any) {
    console.error('Get sales analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sales analytics' });
  }
};

export const getOutstandingSummary = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        isActive: true,
        currentBalance: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        currentBalance: true,
        creditDays: true
      },
      orderBy: {
        currentBalance: 'desc'
      },
      take: 10
    });

    const totalOutstanding = customers.reduce((sum, c) => 
      sum + Number(c.currentBalance), 0
    );

    res.json({
      customers,
      totalOutstanding,
      count: customers.length
    });
  } catch (error: any) {
    console.error('Get outstanding summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch outstanding summary' });
  }
};

export const getPayableSummary = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId,
        isActive: true,
        currentBalance: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        currentBalance: true,
        creditDays: true
      },
      orderBy: {
        currentBalance: 'desc'
      },
      take: 10
    });

    const totalPayable = suppliers.reduce((sum, s) => 
      sum + Number(s.currentBalance), 0
    );

    res.json({
      suppliers,
      totalPayable,
      count: suppliers.length
    });
  } catch (error: any) {
    console.error('Get payable summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payable summary' });
  }
};

export const getRecentTransactions = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { limit = '10' } = req.query;

    const [recentInvoices, recentPayments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          companyId,
          isCancelled: false
        },
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          date: true,
          grandTotal: true,
          paymentStatus: true,
          partyType: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: parseInt(limit as string)
      }),
      prisma.payment.findMany({
        where: {
          companyId
        },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          paymentMode: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: parseInt(limit as string)
      })
    ]);

    res.json({
      invoices: recentInvoices,
      payments: recentPayments
    });
  } catch (error: any) {
    console.error('Get recent transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch recent transactions' });
  }
};

