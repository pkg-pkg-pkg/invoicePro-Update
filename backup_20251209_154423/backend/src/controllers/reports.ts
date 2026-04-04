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

// ==================== SALES REPORTS ====================

// Sales Register - Complete invoice list
export const getSalesRegister = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const {
      fromDate,
      toDate,
      customerId,
      productId,
      categoryId,
      paymentStatus,
      invoiceStatus,
      paymentMode,
      minAmount,
      maxAmount,
      page = '1',
      limit = '100',
      groupBy,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      type: { in: ['SALES_INVOICE', 'SALES_RETURN'] },
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    if (customerId) where.partyId = customerId as string;
    if (paymentStatus) where.paymentStatus = paymentStatus as any;
    if (invoiceStatus === 'cancelled') where.isCancelled = true;
    if (invoiceStatus === 'active') where.isCancelled = false;
    if (minAmount) where.grandTotal = { gte: Number(minAmount) };
    if (maxAmount) {
      where.grandTotal = {
        ...(where.grandTotal as any || {}),
        lte: Number(maxAmount)
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        payments: true
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc',
      },
      skip,
      take: limitNum,
    });

    // Calculate paid amount and balance for each invoice
    const reportData = invoices.map(invoice => {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const balance = Number(invoice.grandTotal) - totalPaid;
      
      return {
        ...invoice,
        paid: totalPaid,
        balance,
        itemsCount: invoice.items.length,
        products: invoice.items.map(item => item.product?.name || item.name).join(', ')
      };
    });

    const total = await prisma.invoice.count({ where });

    res.json({
      data: reportData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      summary: {
        totalInvoices: total,
        totalAmount: reportData.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
        totalPaid: reportData.reduce((sum, inv) => sum + inv.paid, 0),
        totalBalance: reportData.reduce((sum, inv) => sum + inv.balance, 0),
        totalTax: reportData.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
      }
    });
  } catch (error: any) {
    console.error('Get sales register error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sales register' });
  }
};

// Sales Summary Report
export const getSalesSummary = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate, groupBy = 'day' } = req.query;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      type: 'SALES_INVOICE',
      isCancelled: false,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true
      },
      orderBy: { date: 'asc' }
    });

    // Group by period
    const grouped: Record<string, {
      period: string;
      invoices: number;
      quantity: number;
      taxableAmount: number;
      tax: number;
      total: number;
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
      } else if (groupBy === 'year') {
        key = String(date.getFullYear());
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          invoices: 0,
          quantity: 0,
          taxableAmount: 0,
          tax: 0,
          total: 0
        };
      }

      grouped[key].invoices += 1;
      grouped[key].quantity += invoice.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      grouped[key].taxableAmount += Number(invoice.subtotal);
      grouped[key].tax += Number(invoice.totalTax);
      grouped[key].total += Number(invoice.grandTotal);
    });

    const summary = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));

    res.json({
      data: summary,
      total: {
        invoices: summary.reduce((sum, s) => sum + s.invoices, 0),
        quantity: summary.reduce((sum, s) => sum + s.quantity, 0),
        taxableAmount: summary.reduce((sum, s) => sum + s.taxableAmount, 0),
        tax: summary.reduce((sum, s) => sum + s.tax, 0),
        total: summary.reduce((sum, s) => sum + s.total, 0),
      }
    });
  } catch (error: any) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sales summary' });
  }
};

// Sales by Customer
export const getSalesByCustomer = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate, topN } = req.query;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      type: 'SALES_INVOICE',
      partyType: 'CUSTOMER',
      isCancelled: false,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true,
        payments: true
      }
    });

    // Group by customer
    const customerSales: Record<string, {
      customerId: string;
      customerName: string;
      invoices: number;
      quantity: number;
      totalAmount: number;
      paid: number;
      balance: number;
      lastPurchaseDate: string;
    }> = {};

    invoices.forEach(invoice => {
      const customerId = invoice.partyId;
      if (!customerSales[customerId]) {
        customerSales[customerId] = {
          customerId,
          customerName: '',
          invoices: 0,
          quantity: 0,
          totalAmount: 0,
          paid: 0,
          balance: 0,
          lastPurchaseDate: invoice.date.toISOString()
        };
      }

      customerSales[customerId].invoices += 1;
      customerSales[customerId].quantity += invoice.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      customerSales[customerId].totalAmount += Number(invoice.grandTotal);
      customerSales[customerId].paid += invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const invoiceDate = new Date(invoice.date);
      const lastDate = new Date(customerSales[customerId].lastPurchaseDate);
      if (invoiceDate > lastDate) {
        customerSales[customerId].lastPurchaseDate = invoice.date.toISOString();
      }
    });

    // Fetch customer names
    const customerIds = Object.keys(customerSales);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds }, companyId },
      select: { id: true, name: true }
    });

    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    
    const reportData = Object.values(customerSales)
      .map(data => ({
        ...data,
        customerName: customerMap.get(data.customerId) || 'Unknown',
        balance: data.totalAmount - data.paid,
        averageInvoiceValue: data.totalAmount / data.invoices
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const topNNum = topN ? parseInt(topN as string) : undefined;
    const result = topNNum ? reportData.slice(0, topNNum) : reportData;

    res.json({
      data: result,
      total: {
        customers: result.length,
        invoices: result.reduce((sum, c) => sum + c.invoices, 0),
        totalAmount: result.reduce((sum, c) => sum + c.totalAmount, 0),
        totalPaid: result.reduce((sum, c) => sum + c.paid, 0),
        totalBalance: result.reduce((sum, c) => sum + c.balance, 0),
      }
    });
  } catch (error: any) {
    console.error('Get sales by customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sales by customer' });
  }
};

// Sales by Product
export const getSalesByProduct = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate, categoryId } = req.query;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      type: 'SALES_INVOICE',
      isCancelled: false,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    // Group by product
    const productSales: Record<string, {
      productId: string;
      productCode: string;
      productName: string;
      category: string;
      quantity: number;
      amount: number;
      averageRate: number;
    }> = {};

    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (item.productId) {
          const productId = item.productId;
          if (!productSales[productId]) {
            productSales[productId] = {
              productId,
              productCode: item.product?.code || '',
              productName: item.product?.name || item.name,
              category: item.product?.category?.name || '',
              quantity: 0,
              amount: 0,
              averageRate: 0
            };
          }

          productSales[productId].quantity += Number(item.quantity);
          productSales[productId].amount += Number(item.totalAmount);
        }
      });
    });

    const reportData = Object.values(productSales)
      .map(data => ({
        ...data,
        averageRate: data.amount / data.quantity
      }))
      .filter(data => !categoryId || data.category === categoryId)
      .sort((a, b) => b.amount - a.amount);

    res.json({
      data: reportData,
      total: {
        products: reportData.length,
        quantity: reportData.reduce((sum, p) => sum + p.quantity, 0),
        amount: reportData.reduce((sum, p) => sum + p.amount, 0),
      }
    });
  } catch (error: any) {
    console.error('Get sales by product error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sales by product' });
  }
};

// ==================== PURCHASE REPORTS ====================

// Purchase Register
export const getPurchaseRegister = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const {
      fromDate,
      toDate,
      supplierId,
      productId,
      paymentStatus,
      page = '1',
      limit = '100'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      type: { in: ['PURCHASE_INVOICE', 'PURCHASE_RETURN'] },
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    if (supplierId) where.partyId = supplierId as string;
    if (paymentStatus) where.paymentStatus = paymentStatus as any;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: { product: true }
        },
        payments: true
      },
      orderBy: { date: 'desc' },
      skip,
      take: limitNum,
    });

    const reportData = invoices.map(invoice => {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const balance = Number(invoice.grandTotal) - totalPaid;
      
      return {
        ...invoice,
        paid: totalPaid,
        balance,
        products: invoice.items.map(item => item.product?.name || item.name).join(', ')
      };
    });

    const total = await prisma.invoice.count({ where });

    res.json({
      data: reportData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      summary: {
        totalBills: total,
        totalAmount: reportData.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
        totalPaid: reportData.reduce((sum, inv) => sum + inv.paid, 0),
        totalBalance: reportData.reduce((sum, inv) => sum + inv.balance, 0),
        totalTax: reportData.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
      }
    });
  } catch (error: any) {
    console.error('Get purchase register error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch purchase register' });
  }
};

// Purchase by Supplier
export const getPurchaseBySupplier = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate } = req.query;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      type: 'PURCHASE_INVOICE',
      partyType: 'SUPPLIER',
      isCancelled: false,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true,
        payments: true
      }
    });

    const supplierPurchases: Record<string, {
      supplierId: string;
      supplierName: string;
      bills: number;
      totalAmount: number;
      paid: number;
      balance: number;
      lastPurchaseDate: string;
    }> = {};

    invoices.forEach(invoice => {
      const supplierId = invoice.partyId;
      if (!supplierPurchases[supplierId]) {
        supplierPurchases[supplierId] = {
          supplierId,
          supplierName: '',
          bills: 0,
          totalAmount: 0,
          paid: 0,
          balance: 0,
          lastPurchaseDate: invoice.date.toISOString()
        };
      }

      supplierPurchases[supplierId].bills += 1;
      supplierPurchases[supplierId].totalAmount += Number(invoice.grandTotal);
      supplierPurchases[supplierId].paid += invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const invoiceDate = new Date(invoice.date);
      const lastDate = new Date(supplierPurchases[supplierId].lastPurchaseDate);
      if (invoiceDate > lastDate) {
        supplierPurchases[supplierId].lastPurchaseDate = invoice.date.toISOString();
      }
    });

    const supplierIds = Object.keys(supplierPurchases);
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds }, companyId },
      select: { id: true, name: true }
    });

    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
    
    const reportData = Object.values(supplierPurchases)
      .map(data => ({
        ...data,
        supplierName: supplierMap.get(data.supplierId) || 'Unknown',
        balance: data.totalAmount - data.paid
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({
      data: reportData,
      total: {
        suppliers: reportData.length,
        bills: reportData.reduce((sum, s) => sum + s.bills, 0),
        totalAmount: reportData.reduce((sum, s) => sum + s.totalAmount, 0),
        totalPaid: reportData.reduce((sum, s) => sum + s.paid, 0),
        totalBalance: reportData.reduce((sum, s) => sum + s.balance, 0),
      }
    });
  } catch (error: any) {
    console.error('Get purchase by supplier error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch purchase by supplier' });
  }
};

// ==================== STOCK REPORTS ====================

// Current Stock Summary
export const getCurrentStock = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { categoryId, showOnly, minStock, maxStock } = req.query;

    const where: Prisma.ProductWhereInput = {
      companyId,
      isActive: true,
    };

    if (categoryId) where.categoryId = categoryId as string;
    if (showOnly === 'outOfStock') where.currentStock = { lte: 0 };
    // Low stock filter will be applied after fetching
    if (minStock) where.currentStock = { gte: Number(minStock) };
    if (maxStock) {
      where.currentStock = {
        ...(where.currentStock as any || {}),
        lte: Number(maxStock)
      };
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });

    // Apply low stock filter if needed
    if (showOnly === 'lowStock') {
      products = products.filter(p => Number(p.currentStock) <= Number(p.lowStockAlert));
    }

    const reportData = products.map(product => ({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category?.name || '',
      currentStock: Number(product.currentStock),
      unit: product.unit,
      purchasePrice: Number(product.purchasePrice),
      salePrice: Number(product.salePrice),
      stockValue: Number(product.currentStock) * Number(product.purchasePrice),
      saleValue: Number(product.currentStock) * Number(product.salePrice),
      lowStockAlert: Number(product.lowStockAlert),
      isLowStock: Number(product.currentStock) <= Number(product.lowStockAlert)
    }));

    res.json({
      data: reportData,
      summary: {
        totalProducts: reportData.length,
        totalStockValue: reportData.reduce((sum, p) => sum + p.stockValue, 0),
        totalSaleValue: reportData.reduce((sum, p) => sum + p.saleValue, 0),
        lowStockCount: reportData.filter(p => p.isLowStock).length,
        outOfStockCount: reportData.filter(p => p.currentStock <= 0).length,
      }
    });
  } catch (error: any) {
    console.error('Get current stock error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch current stock' });
  }
};

// Stock Movement Report
export const getStockMovement = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate, productId, type, page = '1', limit = '100' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.StockMovementWhereInput = {
      product: {
        companyId
      }
    };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate as string);
      if (toDate) where.createdAt.lte = new Date(toDate as string);
    }

    if (productId) where.productId = productId as string;
    if (type) where.type = type as any;

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          include: {
            category: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });

    const total = await prisma.stockMovement.count({ where });

    res.json({
      data: movements,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error: any) {
    console.error('Get stock movement error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stock movement' });
  }
};

// Low Stock Report
export const getLowStock = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const products = await prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
      },
      include: {
        category: true
      },
      orderBy: { currentStock: 'asc' }
    });

    // Filter low stock products
    const lowStockProducts = products.filter(p => 
      Number(p.currentStock) <= Number(p.lowStockAlert)
    );

    const reportData = lowStockProducts.map(product => ({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category?.name || '',
      currentStock: Number(product.currentStock),
      lowStockAlert: Number(product.lowStockAlert),
      requiredQty: Number(product.lowStockAlert) - Number(product.currentStock),
      unit: product.unit,
      purchasePrice: Number(product.purchasePrice),
      estimatedCost: (Number(product.lowStockAlert) - Number(product.currentStock)) * Number(product.purchasePrice)
    }));

    res.json({
      data: reportData,
      summary: {
        totalProducts: reportData.length,
        totalRequiredQty: reportData.reduce((sum, p) => sum + p.requiredQty, 0),
        estimatedCost: reportData.reduce((sum, p) => sum + p.estimatedCost, 0),
      }
    });
  } catch (error: any) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch low stock' });
  }
};

// ==================== FINANCIAL REPORTS ====================

// Day Book
export const getDayBook = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Receipts
    const salesInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: 'SALES_INVOICE',
        date: { gte: targetDate, lt: nextDate },
        isCancelled: false
      }
    });

    const receipts = await prisma.payment.findMany({
      where: {
        companyId,
        type: 'RECEIPT',
        date: { gte: targetDate, lt: nextDate }
      }
    });

    // Payments
    const purchaseInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: 'PURCHASE_INVOICE',
        date: { gte: targetDate, lt: nextDate },
        isCancelled: false
      }
    });

    const payments = await prisma.payment.findMany({
      where: {
        companyId,
        type: 'PAYMENT',
        date: { gte: targetDate, lt: nextDate }
      }
    });

    const totalReceipts = salesInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0) +
      receipts.reduce((sum, p) => sum + Number(p.amount), 0);

    const totalPayments = purchaseInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0) +
      payments.reduce((sum, p) => sum + Number(p.amount), 0);

    res.json({
      date: targetDate.toISOString().split('T')[0],
      receipts: {
        sales: salesInvoices.map(inv => ({
          type: 'Sales',
          reference: inv.invoiceNumber,
          amount: Number(inv.grandTotal),
          date: inv.date
        })),
        payments: receipts.map(p => ({
          type: 'Payment Received',
          reference: p.referenceNumber || p.id,
          amount: Number(p.amount),
          date: p.date
        })),
        total: totalReceipts
      },
      payments: {
        purchases: purchaseInvoices.map(inv => ({
          type: 'Purchase',
          reference: inv.invoiceNumber,
          amount: Number(inv.grandTotal),
          date: inv.date
        })),
        payments: payments.map(p => ({
          type: 'Payment Made',
          reference: p.referenceNumber || p.id,
          amount: Number(p.amount),
          date: p.date
        })),
        total: totalPayments
      },
      netCashFlow: totalReceipts - totalPayments
    });
  } catch (error: any) {
    console.error('Get day book error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch day book' });
  }
};

// Profit & Loss Statement
export const getProfitAndLoss = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate } = req.query;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      isCancelled: false,
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }
// CONTINUATION OF reports.ts - getProfitAndLoss and remaining functions

    // Sales
    const salesInvoices = await prisma.invoice.findMany({
      where: {
        ...where,
        type: 'SALES_INVOICE'
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    const salesReturns = await prisma.invoice.findMany({
      where: {
        ...where,
        type: 'SALES_RETURN'
      }
    });

    const totalSales = salesInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
    const totalSalesReturns = salesReturns.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
    const netSales = totalSales - totalSalesReturns;

    // Purchases
    const purchaseInvoices = await prisma.invoice.findMany({
      where: {
        ...where,
        type: 'PURCHASE_INVOICE'
      },
      include: { items: true }
    });

    const purchaseReturns = await prisma.invoice.findMany({
      where: {
        ...where,
        type: 'PURCHASE_RETURN'
      }
    });

    // Calculate cost of goods sold (simplified - using purchase price)
    let costOfGoodsSold = 0;
    salesInvoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (item.productId && item.product) {
          costOfGoodsSold += Number(item.quantity) * Number(item.product.purchasePrice);
        }
      });
    });

    const totalPurchase = purchaseInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
    const totalPurchaseReturns = purchaseReturns.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
    const netPurchase = totalPurchase - totalPurchaseReturns;

    const grossProfit = netSales - costOfGoodsSold;

    // TODO: Add operating expenses from a separate expenses table
    const operatingExpenses = 0;
    const netProfit = grossProfit - operatingExpenses;

    res.json({
      period: {
        from: fromDate || '',
        to: toDate || ''
      },
      income: {
        sales: totalSales,
        salesReturns: totalSalesReturns,
        netSales,
        otherIncome: 0, // TODO: Implement other income
        totalIncome: netSales
      },
      expenses: {
        purchases: totalPurchase,
        purchaseReturns: totalPurchaseReturns,
        netPurchase,
        costOfGoodsSold,
        operatingExpenses,
        totalExpenses: costOfGoodsSold + operatingExpenses
      },
      profit: {
        grossProfit,
        netProfit,
        profitPercentage: netSales > 0 ? (netProfit / netSales) * 100 : 0
      }
    });
  } catch (error: any) {
    console.error('Get profit and loss error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profit and loss' });
  }
};

// ==================== PARTY REPORTS ====================

// Customer Outstanding Report
export const getCustomerOutstanding = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        isActive: true,
        currentBalance: { gt: 0 }
      },
      include: {
        invoices: {
          where: {
            paymentStatus: { in: ['PENDING', 'PARTIAL'] },
            isCancelled: false
          },
          include: {
            payments: true
          },
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { currentBalance: 'desc' }
    });

    const reportData = customers.map(customer => {
      // Calculate aging
      const now = new Date();
      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90 = 0;
      let days90Plus = 0;

      customer.invoices.forEach(invoice => {
        const daysDiff = Math.floor((now.getTime() - invoice.date.getTime()) / (1000 * 60 * 60 * 24));
        const invoiceBalance = Number(invoice.grandTotal) - 
          invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);

        if (daysDiff <= 0) {
          current += invoiceBalance;
        } else if (daysDiff <= 30) {
          days30 += invoiceBalance;
        } else if (daysDiff <= 60) {
          days60 += invoiceBalance;
        } else if (daysDiff <= 90) {
          days90 += invoiceBalance;
        } else {
          days90Plus += invoiceBalance;
        }
      });

      return {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        email: customer.email,
        totalOutstanding: Number(customer.currentBalance),
        current,
        days30,
        days60,
        days90,
        days90Plus,
        invoiceCount: customer.invoices.length
      };
    });

    res.json({
      data: reportData,
      summary: {
        totalCustomers: reportData.length,
        totalOutstanding: reportData.reduce((sum, c) => sum + c.totalOutstanding, 0),
        totalCurrent: reportData.reduce((sum, c) => sum + c.current, 0),
        totalDays30: reportData.reduce((sum, c) => sum + c.days30, 0),
        totalDays60: reportData.reduce((sum, c) => sum + c.days60, 0),
        totalDays90: reportData.reduce((sum, c) => sum + c.days90, 0),
        totalDays90Plus: reportData.reduce((sum, c) => sum + c.days90Plus, 0),
      }
    });
  } catch (error: any) {
    console.error('Get customer outstanding error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer outstanding' });
  }
};

// Supplier Payable Report
export const getSupplierPayable = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId,
        isActive: true,
        currentBalance: { gt: 0 }
      },
      include: {
        invoices: {
          where: {
            paymentStatus: { in: ['PENDING', 'PARTIAL'] },
            isCancelled: false
          },
          include: {
            payments: true
          },
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { currentBalance: 'desc' }
    });

    const reportData = suppliers.map(supplier => {
      const now = new Date();
      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90 = 0;
      let days90Plus = 0;

      supplier.invoices.forEach(invoice => {
        const daysDiff = Math.floor((now.getTime() - invoice.date.getTime()) / (1000 * 60 * 60 * 24));
        const invoiceBalance = Number(invoice.grandTotal) - 
          invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);

        if (daysDiff <= 0) {
          current += invoiceBalance;
        } else if (daysDiff <= 30) {
          days30 += invoiceBalance;
        } else if (daysDiff <= 60) {
          days60 += invoiceBalance;
        } else if (daysDiff <= 90) {
          days90 += invoiceBalance;
        } else {
          days90Plus += invoiceBalance;
        }
      });

      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        totalPayable: Number(supplier.currentBalance),
        current,
        days30,
        days60,
        days90,
        days90Plus,
        billCount: supplier.invoices.length
      };
    });

    res.json({
      data: reportData,
      summary: {
        totalSuppliers: reportData.length,
        totalPayable: reportData.reduce((sum, s) => sum + s.totalPayable, 0),
        totalCurrent: reportData.reduce((sum, s) => sum + s.current, 0),
        totalDays30: reportData.reduce((sum, s) => sum + s.days30, 0),
        totalDays60: reportData.reduce((sum, s) => sum + s.days60, 0),
        totalDays90: reportData.reduce((sum, s) => sum + s.days90, 0),
        totalDays90Plus: reportData.reduce((sum, s) => sum + s.days90Plus, 0),
      }
    });
  } catch (error: any) {
    console.error('Get supplier payable error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch supplier payable' });
  }
};

// ==================== PAYMENT REPORTS ====================

// Payment Received Report
export const getPaymentReceived = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate, customerId, paymentMode, page = '1', limit = '100' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.PaymentWhereInput = {
      companyId,
      type: 'RECEIPT',
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    if (customerId) where.partyId = customerId as string;
    if (paymentMode) where.paymentMode = paymentMode as any;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true
          }
        },
        bank: true
      },
      orderBy: { date: 'desc' },
      skip,
      take: limitNum,
    });

    // Get customer names
    const customerIds = [...new Set(payments.map(p => p.partyId))];
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds }, companyId },
      select: { id: true, name: true }
    });

    const customerMap = new Map(customers.map(c => [c.id, c.name]));

    const reportData = payments.map(payment => ({
      ...payment,
      customerName: customerMap.get(payment.partyId) || 'Unknown',
      amount: Number(payment.amount)
    }));

    const total = await prisma.payment.count({ where });

    res.json({
      data: reportData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      summary: {
        totalReceipts: total,
        totalAmount: reportData.reduce((sum, p) => sum + p.amount, 0),
        byMode: reportData.reduce((acc, p) => {
          const mode = p.paymentMode;
          acc[mode] = (acc[mode] || 0) + p.amount;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error: any) {
    console.error('Get payment received error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment received' });
  }
};

// Payment Made Report
export const getPaymentMade = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate, supplierId, paymentMode, page = '1', limit = '100' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.PaymentWhereInput = {
      companyId,
      type: 'PAYMENT',
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    if (supplierId) where.partyId = supplierId as string;
    if (paymentMode) where.paymentMode = paymentMode as any;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true
          }
        },
        bank: true
      },
      orderBy: { date: 'desc' },
      skip,
      take: limitNum,
    });

    const supplierIds = [...new Set(payments.map(p => p.partyId))];
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds }, companyId },
      select: { id: true, name: true }
    });

    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    const reportData = payments.map(payment => ({
      ...payment,
      supplierName: supplierMap.get(payment.partyId) || 'Unknown',
      amount: Number(payment.amount)
    }));

    const total = await prisma.payment.count({ where });

    res.json({
      data: reportData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      summary: {
        totalPayments: total,
        totalAmount: reportData.reduce((sum, p) => sum + p.amount, 0),
        byMode: reportData.reduce((acc, p) => {
          const mode = p.paymentMode;
          acc[mode] = (acc[mode] || 0) + p.amount;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error: any) {
    console.error('Get payment made error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment made' });
  }
};