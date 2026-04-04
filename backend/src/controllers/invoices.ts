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

// Calculate GST for an item
const calculateItemGST = (
  taxableAmount: number,
  gstRate: number,
  transactionType: 'INTRA_STATE' | 'INTER_STATE'
) => {
  const taxAmount = (taxableAmount * gstRate) / 100;
  
  if (transactionType === 'INTRA_STATE') {
    return {
      cgst: taxAmount / 2,
      sgst: taxAmount / 2,
      igst: 0,
      totalTax: taxAmount,
    };
  } else {
    return {
      cgst: 0,
      sgst: 0,
      igst: taxAmount,
      totalTax: taxAmount,
    };
  }
};

// Determine transaction type based on company and party state
const getTransactionType = async (
  companyId: string,
  partyId: string,
  partyType: 'CUSTOMER' | 'SUPPLIER'
): Promise<'INTRA_STATE' | 'INTER_STATE'> => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { state: true },
  });

  let partyState = '';
  if (partyType === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({
      where: { id: partyId },
      select: { state: true },
    });
    partyState = customer?.state || '';
  } else {
    const supplier = await prisma.supplier.findUnique({
      where: { id: partyId },
      select: { state: true },
    });
    partyState = supplier?.state || '';
  }

  return company?.state === partyState ? 'INTRA_STATE' : 'INTER_STATE';
};

// Generate invoice number
const generateInvoiceNumber = async (
  companyId: string,
  type: string,
  date: Date
): Promise<string> => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Get last invoice number for this type and month
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      companyId,
      type: type as any,
      invoiceNumber: {
        startsWith: `${type}/${year}-${month}/`,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  let sequence = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoiceNumber.split('/');
    const lastSeq = parseInt(parts[parts.length - 1]) || 0;
    sequence = lastSeq + 1;
  }

  const seq = String(sequence).padStart(4, '0');
  return `${type}/${year}-${month}/${seq}`;
};

// Calculate invoice totals
const calculateInvoiceTotals = (items: any[], billDiscount: number, billDiscountType: string) => {
  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalTax = 0;

  for (const item of items) {
    subtotal += Number(item.taxableAmount);
    totalCGST += Number(item.cgst);
    totalSGST += Number(item.sgst);
    totalIGST += Number(item.igst);
    totalTax += Number(item.totalTax);
  }

  // Apply bill-level discount
  let discountAmount = 0;
  if (billDiscount > 0) {
    if (billDiscountType === 'PERCENTAGE') {
      discountAmount = (subtotal * billDiscount) / 100;
    } else {
      discountAmount = billDiscount;
    }
  }

  const totalAfterDiscount = subtotal - discountAmount;
  const grandTotal = totalAfterDiscount + totalTax;
  const roundOff = Math.round(grandTotal) - grandTotal;

  return {
    subtotal,
    discount: discountAmount,
    totalAmount: totalAfterDiscount,
    cgst: totalCGST,
    sgst: totalSGST,
    igst: totalIGST,
    totalTax,
    roundOff,
    grandTotal: Math.round(grandTotal),
  };
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      page = '1',
      limit = '50',
      type = '',
      partyId = '',
      fromDate = '',
      toDate = '',
      paymentStatus = '',
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      isCancelled: false,
    };

    if (type) {
      where.type = type as any;
    }

    if (partyId) {
      where.partyId = partyId as string;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus as any;
    }

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) {
        where.date.gte = new Date(fromDate as string);
      }
      if (toDate) {
        where.date.lte = new Date(toDate as string);
      }
    }

    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {};
    if (sortBy === 'date') {
      orderBy.date = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'grandTotal') {
      orderBy.grandTotal = sortOrder as 'asc' | 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          items: true,
        },
        skip,
        take: limitNum,
        orderBy,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      data: invoices,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invoices' });
  }
};

export const getInvoice = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error: any) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invoice' });
  }
};

export const getNextInvoiceNumber = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ error: 'Invoice type is required' });
    }

    const invoiceNumber = await generateInvoiceNumber(
      companyId,
      type as string,
      new Date()
    );

    res.json({ invoiceNumber });
  } catch (error: any) {
    console.error('Get next invoice number error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate invoice number' });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const userId = req.user!.id;
    
    const {
      invoiceNumber,
      type,
      date,
      partyId,
      partyType,
      items,
      discount = 0,
      discountType = 'PERCENTAGE',
      additionalCharges = [],
      notes,
      terms,
      paymentMode = [],
    } = req.body;

    // Validation
    if (!type || !date || !partyId || !partyType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Get transaction type (INTRA_STATE or INTER_STATE)
    const transactionType = await getTransactionType(companyId, partyId, partyType);

    // Calculate item totals and GST
    const calculatedItems = items.map((item: any) => {
      const quantity = Number(item.quantity);
      const rate = Number(item.rate);
      const itemTotal = quantity * rate;

      // Item-level discount
      let itemDiscount = 0;
      if (item.discount > 0) {
        if (item.discountType === 'PERCENTAGE') {
          itemDiscount = (itemTotal * item.discount) / 100;
        } else {
          itemDiscount = item.discount;
        }
      }

      const taxableAmount = itemTotal - itemDiscount;
      const gstRate = Number(item.gstRate) || 0;
      const gst = calculateItemGST(taxableAmount, gstRate, transactionType);

      return {
        productId: item.productId || null,
        name: item.name,
        hsnCode: item.hsnCode || null,
        sacCode: item.sacCode || null,
        quantity,
        unit: item.unit,
        rate,
        discount: item.discount || 0,
        discountType: item.discountType || 'PERCENTAGE',
        taxableAmount,
        gstRate,
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        totalTax: gst.totalTax,
        totalAmount: taxableAmount + gst.totalTax,
        batchNumber: item.batchNumber || null,
        serialNumber: item.serialNumber || null,
      };
    });

    // Calculate invoice totals
    const totals = calculateInvoiceTotals(calculatedItems, discount, discountType);

    // Generate invoice number if not provided
    let finalInvoiceNumber = invoiceNumber;
    if (!finalInvoiceNumber) {
      finalInvoiceNumber = await generateInvoiceNumber(companyId, type, new Date(date));
    }

    // Check duplicate invoice number
    const existing = await prisma.invoice.findFirst({
      where: {
        companyId,
        invoiceNumber: finalInvoiceNumber,
      },
    });
    if (existing) {
      return res.status(400).json({ error: 'Invoice number already exists' });
    }

    // Create invoice in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: finalInvoiceNumber,
          type,
          date: new Date(date),
          partyId,
          partyType,
          subtotal: totals.subtotal,
          discount: totals.discount,
          discountType: discountType as any,
          additionalCharges: additionalCharges.length > 0 ? additionalCharges : null,
          roundOff: totals.roundOff,
          totalAmount: totals.totalAmount,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          totalTax: totals.totalTax,
          grandTotal: totals.grandTotal,
          paymentStatus: 'PENDING',
          paymentMode: paymentMode,
          notes: notes || null,
          terms: terms || null,
          companyId,
          createdBy: userId,
          items: {
            create: calculatedItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Update stock for sales invoices
      if (type === 'SALES_INVOICE' || type === 'SALES_RETURN') {
        for (const item of calculatedItems) {
          if (item.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });

            if (product) {
              const stockChange = type === 'SALES_INVOICE' 
                ? -Number(item.quantity) 
                : Number(item.quantity);

              await tx.product.update({
                where: { id: item.productId },
                data: {
                  currentStock: {
                    increment: stockChange,
                  },
                },
              });

              // Create stock movement
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: type === 'SALES_INVOICE' ? 'SALE' : 'RETURN',
                  quantity: Math.abs(stockChange),
                  rate: item.rate,
                  referenceId: invoice.id,
                  referenceType: 'INVOICE',
                  createdBy: userId,
                },
              });
            }
          }
        }
      }

      // Update stock for purchase invoices
      if (type === 'PURCHASE_INVOICE' || type === 'PURCHASE_RETURN') {
        for (const item of calculatedItems) {
          if (item.productId) {
            const stockChange = type === 'PURCHASE_INVOICE'
              ? Number(item.quantity)
              : -Number(item.quantity);

            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: {
                  increment: stockChange,
                },
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: type === 'PURCHASE_INVOICE' ? 'PURCHASE' : 'RETURN',
                quantity: Math.abs(stockChange),
                rate: item.rate,
                referenceId: invoice.id,
                referenceType: 'INVOICE',
                createdBy: userId,
              },
            });
          }
        }
      }

      // Update party outstanding/payable
      if (partyType === 'CUSTOMER') {
        await tx.customer.update({
          where: { id: partyId },
          data: {
            currentBalance: {
              increment: totals.grandTotal,
            },
          },
        });
      } else {
        await tx.supplier.update({
          where: { id: partyId },
          data: {
            currentBalance: {
              increment: totals.grandTotal,
            },
          },
        });
      }

      return invoice;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Create invoice error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate invoice number' });
    }
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  }
};

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const existing = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (existing.isCancelled) {
      return res.status(400).json({ error: 'Cannot update cancelled invoice' });
    }

    // For now, only allow updating notes, terms, and payment status
    // Full update would require reversing stock and recalculating
    const { notes, terms, paymentStatus } = req.body;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(terms !== undefined && { terms }),
        ...(paymentStatus !== undefined && { paymentStatus }),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    res.json(invoice);
  } catch (error: any) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to update invoice' });
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Cannot delete if has payments
    const payments = await prisma.payment.findMany({
      where: { invoiceId: id },
    });

    if (payments.length > 0) {
      return res.status(403).json({
        error: 'Cannot delete invoice with payments',
        message: 'Please cancel the invoice instead',
      });
    }

    // Reverse stock and outstanding in transaction
    await prisma.$transaction(async (tx) => {
      // Reverse stock
      if (invoice.type === 'SALES_INVOICE' || invoice.type === 'SALES_RETURN') {
        for (const item of invoice.items) {
          if (item.productId) {
            const stockChange = invoice.type === 'SALES_INVOICE'
              ? Number(item.quantity)
              : -Number(item.quantity);

            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: {
                  increment: stockChange,
                },
              },
            });
          }
        }
      }

      // Reverse party balance
      if (invoice.partyType === 'CUSTOMER') {
        await tx.customer.update({
          where: { id: invoice.partyId },
          data: {
            currentBalance: {
              decrement: Number(invoice.grandTotal),
            },
          },
        });
      } else {
        await tx.supplier.update({
          where: { id: invoice.partyId },
          data: {
            currentBalance: {
              decrement: Number(invoice.grandTotal),
            },
          },
        });
      }

      // Delete invoice (cascade will delete items)
      await tx.invoice.delete({
        where: { id },
      });
    });

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error: any) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete invoice' });
  }
};

export const cancelInvoice = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const userId = req.user!.id;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.isCancelled) {
      return res.status(400).json({ error: 'Invoice is already cancelled' });
    }

    // Reverse stock and outstanding in transaction
    await prisma.$transaction(async (tx) => {
      // Reverse stock
      if (invoice.type === 'SALES_INVOICE' || invoice.type === 'SALES_RETURN') {
        for (const item of invoice.items) {
          if (item.productId) {
            const stockChange = invoice.type === 'SALES_INVOICE'
              ? Number(item.quantity)
              : -Number(item.quantity);

            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: {
                  increment: stockChange,
                },
              },
            });
          }
        }
      }

      if (invoice.type === 'PURCHASE_INVOICE' || invoice.type === 'PURCHASE_RETURN') {
        for (const item of invoice.items) {
          if (item.productId) {
            const stockChange = invoice.type === 'PURCHASE_INVOICE'
              ? -Number(item.quantity)
              : Number(item.quantity);

            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: {
                  increment: stockChange,
                },
              },
            });
          }
        }
      }

      // Reverse party balance
      if (invoice.partyType === 'CUSTOMER') {
        await tx.customer.update({
          where: { id: invoice.partyId },
          data: {
            currentBalance: {
              decrement: Number(invoice.grandTotal),
            },
          },
        });
      } else {
        await tx.supplier.update({
          where: { id: invoice.partyId },
          data: {
            currentBalance: {
              decrement: Number(invoice.grandTotal),
            },
          },
        });
      }

      // Mark invoice as cancelled
      await tx.invoice.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledBy: userId,
        },
      });
    });

    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    console.error('Cancel invoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel invoice' });
  }
};

export const printInvoice = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Return invoice data for printing
    // Actual PDF generation would be done on frontend or using a library like pdfkit
    res.json({
      invoice,
      printData: {
        // Format data for printing
        company: await prisma.company.findUnique({ where: { id: companyId } }),
        party: invoice.partyType === 'CUSTOMER'
          ? await prisma.customer.findUnique({ where: { id: invoice.partyId } })
          : await prisma.supplier.findUnique({ where: { id: invoice.partyId } }),
      },
    });
  } catch (error: any) {
    console.error('Print invoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to get invoice for printing' });
  }
};

export const emailInvoice = async (req: Request, res: Response) => {
  // TODO: Implement email sending
  res.json({ message: 'Email sending not implemented yet' });
};

