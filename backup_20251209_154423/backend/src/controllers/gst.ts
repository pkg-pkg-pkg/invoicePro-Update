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

// Helper to determine transaction type (INTRA_STATE or INTER_STATE)
const getTransactionType = (companyState: string, partyState: string): 'INTRA_STATE' | 'INTER_STATE' => {
  return companyState === partyState ? 'INTRA_STATE' : 'INTER_STATE';
};

// GSTR-1: Outward Supplies (Sales)
export const getGSTR1 = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get company state
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { state: true }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get all sales invoices for the month
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: { in: ['SALES_INVOICE', 'SALES_RETURN'] },
        date: { gte: startDate, lte: endDate },
        isCancelled: false,
      },
      include: {
        items: true,
        customer: true,
        supplier: true,
      },
    });

    // Group by transaction type and GST rate
    const b2b: any[] = [];
    const b2c: any[] = [];
    const hsnSummary: Record<string, any> = {};

    for (const invoice of invoices) {
      const party = invoice.partyType === 'CUSTOMER' ? await prisma.customer.findUnique({
        where: { id: invoice.partyId }
      }) : null;

      const transactionType = party?.gstin
        ? getTransactionType(company.state, party.state || '')
        : 'INTER_STATE';

      for (const item of invoice.items) {
        const hsnCode = item.hsnCode || item.sacCode || 'N/A';
        
        if (!hsnSummary[hsnCode]) {
          hsnSummary[hsnCode] = {
            hsnCode,
            description: item.name,
            uqc: 'PCS',
            quantity: 0,
            rate: 0,
            taxableValue: 0,
            igst: 0,
            cgst: 0,
            sgst: 0,
            cess: 0,
          };
        }

        const qty = Number(item.quantity);
        const rate = Number(item.rate);
        const taxableValue = Number(item.taxableAmount);

        hsnSummary[hsnCode].quantity += qty;
        hsnSummary[hsnCode].rate = rate;
        hsnSummary[hsnCode].taxableValue += taxableValue;
        hsnSummary[hsnCode].igst += Number(item.igst);
        hsnSummary[hsnCode].cgst += Number(item.cgst);
        hsnSummary[hsnCode].sgst += Number(item.sgst);

        // B2B or B2C
        if (party?.gstin) {
          b2b.push({
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.date,
            customerGSTIN: party.gstin,
            customerName: party.name,
            taxableValue,
            igst: Number(item.igst),
            cgst: Number(item.cgst),
            sgst: Number(item.sgst),
            totalTax: Number(item.totalTax),
            totalAmount: Number(item.totalAmount),
            hsnCode,
          });
        } else {
          b2c.push({
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.date,
            customerName: party?.name || 'Unregistered',
            taxableValue,
            igst: Number(item.igst),
            cgst: Number(item.cgst),
            sgst: Number(item.sgst),
            totalTax: Number(item.totalTax),
            totalAmount: Number(item.totalAmount),
            hsnCode,
          });
        }
      }
    }

    res.json({
      period: { month: monthNum, year: yearNum },
      b2b,
      b2c,
      hsnSummary: Object.values(hsnSummary),
      summary: {
        totalB2BInvoices: b2b.length,
        totalB2CInvoices: b2c.length,
        totalTaxableValue: invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
        totalIGST: invoices.reduce((sum, inv) => sum + Number(inv.igst), 0),
        totalCGST: invoices.reduce((sum, inv) => sum + Number(inv.cgst), 0),
        totalSGST: invoices.reduce((sum, inv) => sum + Number(inv.sgst), 0),
      },
    });
  } catch (error: any) {
    console.error('GSTR-1 error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate GSTR-1' });
  }
};

// GSTR-2: Inward Supplies (Purchases)
export const getGSTR2 = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get all purchase invoices for the month
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: { in: ['PURCHASE_INVOICE', 'PURCHASE_RETURN'] },
        date: { gte: startDate, lte: endDate },
        isCancelled: false,
      },
      include: {
        items: true,
      },
    });

    const b2b: any[] = [];
    const hsnSummary: Record<string, any> = {};

    for (const invoice of invoices) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: invoice.partyId }
      });

      for (const item of invoice.items) {
        const hsnCode = item.hsnCode || item.sacCode || 'N/A';
        
        if (!hsnSummary[hsnCode]) {
          hsnSummary[hsnCode] = {
            hsnCode,
            description: item.name,
            uqc: 'PCS',
            quantity: 0,
            rate: 0,
            taxableValue: 0,
            igst: 0,
            cgst: 0,
            sgst: 0,
            itc: 0,
          };
        }

        const qty = Number(item.quantity);
        const rate = Number(item.rate);
        const taxableValue = Number(item.taxableAmount);
        const itc = Number(item.totalTax); // ITC = Input Tax Credit

        hsnSummary[hsnCode].quantity += qty;
        hsnSummary[hsnCode].rate = rate;
        hsnSummary[hsnCode].taxableValue += taxableValue;
        hsnSummary[hsnCode].igst += Number(item.igst);
        hsnSummary[hsnCode].cgst += Number(item.cgst);
        hsnSummary[hsnCode].sgst += Number(item.sgst);
        hsnSummary[hsnCode].itc += itc;

        if (supplier?.gstin) {
          b2b.push({
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.date,
            supplierGSTIN: supplier.gstin,
            supplierName: supplier.name,
            taxableValue,
            igst: Number(item.igst),
            cgst: Number(item.cgst),
            sgst: Number(item.sgst),
            itc,
            totalAmount: Number(item.totalAmount),
            hsnCode,
          });
        }
      }
    }

    res.json({
      period: { month: monthNum, year: yearNum },
      b2b,
      hsnSummary: Object.values(hsnSummary),
      summary: {
        totalInvoices: invoices.length,
        totalTaxableValue: invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
        totalITC: invoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
        totalIGST: invoices.reduce((sum, inv) => sum + Number(inv.igst), 0),
        totalCGST: invoices.reduce((sum, inv) => sum + Number(inv.cgst), 0),
        totalSGST: invoices.reduce((sum, inv) => sum + Number(inv.sgst), 0),
      },
    });
  } catch (error: any) {
    console.error('GSTR-2 error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate GSTR-2' });
  }
};

// GSTR-3B: Monthly Summary Return
export const getGSTR3B = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get sales invoices (outward supplies)
    const salesInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: 'SALES_INVOICE',
        date: { gte: startDate, lte: endDate },
        isCancelled: false,
      },
      include: { items: true },
    });

    // Get purchase invoices (inward supplies)
    const purchaseInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: 'PURCHASE_INVOICE',
        date: { gte: startDate, lte: endDate },
        isCancelled: false,
      },
      include: { items: true },
    });

    // Calculate outward supplies (sales)
    const outwardSupplies = {
      totalTaxableValue: salesInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
      totalIGST: salesInvoices.reduce((sum, inv) => sum + Number(inv.igst), 0),
      totalCGST: salesInvoices.reduce((sum, inv) => sum + Number(inv.cgst), 0),
      totalSGST: salesInvoices.reduce((sum, inv) => sum + Number(inv.sgst), 0),
      totalTax: salesInvoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
    };

    // Calculate inward supplies (purchases) - ITC
    const inwardSupplies = {
      totalTaxableValue: purchaseInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
      totalIGST: purchaseInvoices.reduce((sum, inv) => sum + Number(inv.igst), 0),
      totalCGST: purchaseInvoices.reduce((sum, inv) => sum + Number(inv.cgst), 0),
      totalSGST: purchaseInvoices.reduce((sum, inv) => sum + Number(inv.sgst), 0),
      totalITC: purchaseInvoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
    };

    // Tax liability
    const taxLiability = {
      igst: Math.max(0, outwardSupplies.totalIGST - inwardSupplies.totalIGST),
      cgst: Math.max(0, outwardSupplies.totalCGST - inwardSupplies.totalCGST),
      sgst: Math.max(0, outwardSupplies.totalSGST - inwardSupplies.totalSGST),
      total: Math.max(0, outwardSupplies.totalTax - inwardSupplies.totalITC),
    };

    res.json({
      period: { month: monthNum, year: yearNum },
      outwardSupplies,
      inwardSupplies,
      taxLiability,
      summary: {
        netTaxPayable: taxLiability.total,
        itcAvailable: inwardSupplies.totalITC,
        itcUtilized: Math.min(inwardSupplies.totalITC, outwardSupplies.totalTax),
      },
    });
  } catch (error: any) {
    console.error('GSTR-3B error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate GSTR-3B' });
  }
};

// GSTR-9: Annual Return
export const getGSTR9 = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: 'Year is required' });
    }

    const yearNum = parseInt(year as string);
    const startDate = new Date(yearNum, 0, 1);
    const endDate = new Date(yearNum, 11, 31, 23, 59, 59);

    // Get all invoices for the year
    const salesInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: { in: ['SALES_INVOICE', 'SALES_RETURN'] },
        date: { gte: startDate, lte: endDate },
        isCancelled: false,
      },
    });

    const purchaseInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: { in: ['PURCHASE_INVOICE', 'PURCHASE_RETURN'] },
        date: { gte: startDate, lte: endDate },
        isCancelled: false,
      },
    });

    // Monthly breakdown
    const monthlyData: any[] = [];
    for (let month = 1; month <= 12; month++) {
      const monthStart = new Date(yearNum, month - 1, 1);
      const monthEnd = new Date(yearNum, month, 0, 23, 59, 59);

      const monthSales = salesInvoices.filter(
        inv => inv.date >= monthStart && inv.date <= monthEnd
      );
      const monthPurchases = purchaseInvoices.filter(
        inv => inv.date >= monthStart && inv.date <= monthEnd
      );

      monthlyData.push({
        month,
        sales: {
          count: monthSales.length,
          total: monthSales.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
          tax: monthSales.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
        },
        purchases: {
          count: monthPurchases.length,
          total: monthPurchases.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
          tax: monthPurchases.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
        },
      });
    }

    // Annual totals
    const annualSummary = {
      totalSales: salesInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
      totalPurchases: purchaseInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
      totalSalesTax: salesInvoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
      totalPurchaseTax: purchaseInvoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
      netTaxPayable: 0,
    };

    annualSummary.netTaxPayable = annualSummary.totalSalesTax - annualSummary.totalPurchaseTax;

    res.json({
      year: yearNum,
      monthlyData,
      annualSummary,
    });
  } catch (error: any) {
    console.error('GSTR-9 error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate GSTR-9' });
  }
};

// Export GSTR-1 to JSON (GSTN format)
export const exportGSTR1 = async (req: Request, res: Response) => {
  try {
    const gstr1Data = await getGSTR1Data(req);
    
    // Format as per GSTN JSON structure
    const gstnFormat = {
      gstin: req.query.gstin || '',
      ret_period: `${req.query.year}${String(req.query.month).padStart(2, '0')}`,
      b2b: gstr1Data.b2b,
      b2cl: gstr1Data.b2c.filter((item: any) => Number(item.taxableValue) > 250000),
      b2cs: gstr1Data.b2c.filter((item: any) => Number(item.taxableValue) <= 250000),
      hsn: gstr1Data.hsnSummary,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=gstr1_${req.query.year}_${req.query.month}.json`);
    res.json(gstnFormat);
  } catch (error: any) {
    console.error('Export GSTR-1 error:', error);
    res.status(500).json({ error: error.message || 'Failed to export GSTR-1' });
  }
};

// Export GSTR-2 to JSON (GSTN format)
export const exportGSTR2 = async (req: Request, res: Response) => {
  try {
    const gstr2Data = await getGSTR2Data(req);
    
    const gstnFormat = {
      gstin: req.query.gstin || '',
      ret_period: `${req.query.year}${String(req.query.month).padStart(2, '0')}`,
      b2b: gstr2Data.b2b,
      hsn: gstr2Data.hsnSummary,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=gstr2_${req.query.year}_${req.query.month}.json`);
    res.json(gstnFormat);
  } catch (error: any) {
    console.error('Export GSTR-2 error:', error);
    res.status(500).json({ error: error.message || 'Failed to export GSTR-2' });
  }
};

// Helper functions for export
async function getGSTR1Data(req: Request) {
  const companyId = await getUserCompanyId(req.user!.id);
  const { month, year } = req.query;
  const monthNum = parseInt(month as string);
  const yearNum = parseInt(year as string);
  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: 'SALES_INVOICE',
      date: { gte: startDate, lte: endDate },
      isCancelled: false,
    },
    include: { items: true },
  });

  const b2b: any[] = [];
  const b2c: any[] = [];
  const hsnSummary: Record<string, any> = {};

  for (const invoice of invoices) {
    const customer = await prisma.customer.findUnique({
      where: { id: invoice.partyId }
    });

    for (const item of invoice.items) {
      const hsnCode = item.hsnCode || 'N/A';
      if (!hsnSummary[hsnCode]) {
        hsnSummary[hsnCode] = {
          hsnCode,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
        };
      }
      hsnSummary[hsnCode].taxableValue += Number(item.taxableAmount);
      hsnSummary[hsnCode].igst += Number(item.igst);
      hsnSummary[hsnCode].cgst += Number(item.cgst);
      hsnSummary[hsnCode].sgst += Number(item.sgst);

      if (customer?.gstin) {
        b2b.push({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.date,
          customerGSTIN: customer.gstin,
          taxableValue: Number(item.taxableAmount),
          igst: Number(item.igst),
          cgst: Number(item.cgst),
          sgst: Number(item.sgst),
        });
      } else {
        b2c.push({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.date,
          taxableValue: Number(item.taxableAmount),
          igst: Number(item.igst),
          cgst: Number(item.cgst),
          sgst: Number(item.sgst),
        });
      }
    }
  }

  return { b2b, b2c, hsnSummary: Object.values(hsnSummary) };
}

async function getGSTR2Data(req: Request) {
  const companyId = await getUserCompanyId(req.user!.id);
  const { month, year } = req.query;
  const monthNum = parseInt(month as string);
  const yearNum = parseInt(year as string);
  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: 'PURCHASE_INVOICE',
      date: { gte: startDate, lte: endDate },
      isCancelled: false,
    },
    include: { items: true },
  });

  const b2b: any[] = [];
  const hsnSummary: Record<string, any> = {};

  for (const invoice of invoices) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: invoice.partyId }
    });

    for (const item of invoice.items) {
      const hsnCode = item.hsnCode || 'N/A';
      if (!hsnSummary[hsnCode]) {
        hsnSummary[hsnCode] = {
          hsnCode,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
        };
      }
      hsnSummary[hsnCode].taxableValue += Number(item.taxableAmount);
      hsnSummary[hsnCode].igst += Number(item.igst);
      hsnSummary[hsnCode].cgst += Number(item.cgst);
      hsnSummary[hsnCode].sgst += Number(item.sgst);

      if (supplier?.gstin) {
        b2b.push({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.date,
          supplierGSTIN: supplier.gstin,
          taxableValue: Number(item.taxableAmount),
          igst: Number(item.igst),
          cgst: Number(item.cgst),
          sgst: Number(item.sgst),
        });
      }
    }
  }

  return { b2b, hsnSummary: Object.values(hsnSummary) };
}

// E-way Bill Generation (Basic - actual integration requires GSTN API)
export const generateEwayBill = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    const companyId = await getUserCompanyId(req.user!.id);

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
        type: 'SALES_INVOICE',
      },
      include: {
        items: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Calculate distance (placeholder - should use actual distance calculation)
    const distance = 100; // km

    // Generate E-way bill number (format: EWB + timestamp)
    const ewayBillNumber = `EWB${Date.now()}`;

    // Update invoice with E-way bill number
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { ewayBillNumber },
    });

    res.json({
      ewayBillNumber,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date,
      distance,
      message: 'E-way bill generated successfully. Note: This is a demo. Actual E-way bill requires GSTN API integration.',
    });
  } catch (error: any) {
    console.error('E-way bill error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate E-way bill' });
  }
};

// Get HSN Summary
export const getHSNSummary = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { fromDate, toDate } = req.query;

    const startDate = fromDate ? new Date(fromDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = toDate ? new Date(toDate as string) : new Date();

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: { in: ['SALES_INVOICE', 'PURCHASE_INVOICE'] },
        date: { gte: startDate, lte: endDate },
        isCancelled: false,
      },
      include: { items: true },
    });

    const hsnSummary: Record<string, any> = {};

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const hsnCode = item.hsnCode || item.sacCode || 'N/A';
        
        if (!hsnSummary[hsnCode]) {
          hsnSummary[hsnCode] = {
            hsnCode,
            description: item.name,
            quantity: 0,
            uqc: 'PCS',
            rate: 0,
            taxableValue: 0,
            igst: 0,
            cgst: 0,
            sgst: 0,
            totalTax: 0,
          };
        }

        hsnSummary[hsnCode].quantity += Number(item.quantity);
        hsnSummary[hsnCode].taxableValue += Number(item.taxableAmount);
        hsnSummary[hsnCode].igst += Number(item.igst);
        hsnSummary[hsnCode].cgst += Number(item.cgst);
        hsnSummary[hsnCode].sgst += Number(item.sgst);
        hsnSummary[hsnCode].totalTax += Number(item.totalTax);
      }
    }

    res.json({
      fromDate: startDate,
      toDate: endDate,
      hsnSummary: Object.values(hsnSummary),
    });
  } catch (error: any) {
    console.error('HSN Summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate HSN summary' });
  }
};