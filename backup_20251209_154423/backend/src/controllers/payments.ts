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

// Get payments with filters, pagination, and search
export const getPayments = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      page = '1',
      limit = '50',
      search = '',
      type = '',
      partyType = '',
      partyId = '',
      paymentMode = '',
      fromDate = '',
      toDate = '',
      invoiceId = '',
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.PaymentWhereInput = {
      companyId,
    };

    if (type) {
      where.type = type as any;
    }

    if (partyType) {
      where.partyType = partyType as any;
    }

    if (partyId) {
      where.partyId = partyId as string;
    }

    if (paymentMode) {
      where.paymentMode = paymentMode as any;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId as string;
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

    // Search filter (reference number, cheque number, notes)
    if (search) {
      where.OR = [
        { referenceNumber: { contains: search as string, mode: 'insensitive' } },
        { chequeNumber: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.payment.count({ where });

    // Get payments with party information
    const payments = await prisma.payment.findMany({
      where,
      include: {
        bank: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            type: true,
            grandTotal: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc',
      },
      skip,
      take: limitNum,
    });

    // Fetch party information for each payment
    const paymentsWithParty = await Promise.all(
      payments.map(async (payment) => {
        let party = null;
        if (payment.partyType === 'CUSTOMER') {
          const customer = await prisma.customer.findUnique({
            where: { id: payment.partyId },
            select: { id: true, name: true },
          });
          party = customer;
        } else {
          const supplier = await prisma.supplier.findUnique({
            where: { id: payment.partyId },
            select: { id: true, name: true },
          });
          party = supplier;
        }
        return {
          ...payment,
          party,
        };
      })
    );

    res.json({
      data: paymentsWithParty,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payments' });
  }
};

// Get single payment
export const getPayment = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        bank: true,
        invoice: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Fetch party information
    let party = null;
    if (payment.partyType === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({
        where: { id: payment.partyId },
        select: { id: true, name: true },
      });
      party = customer;
    } else {
      const supplier = await prisma.supplier.findUnique({
        where: { id: payment.partyId },
        select: { id: true, name: true },
      });
      party = supplier;
    }

    res.json({
      ...payment,
      party,
    });
  } catch (error: any) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment' });
  }
};

// Create payment
export const createPayment = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const userId = req.user!.id;

    const {
      type,
      partyId,
      partyType,
      amount,
      paymentMode,
      referenceNumber,
      chequeNumber,
      chequeDate,
      bankId,
      invoiceId,
      notes,
      date,
    } = req.body;

    // Validation
    if (!type || !partyId || !partyType || !amount || !paymentMode || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Validate party exists and belongs to company
    if (partyType === 'CUSTOMER') {
      const customer = await prisma.customer.findFirst({
        where: { id: partyId, companyId },
      });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    } else {
      const supplier = await prisma.supplier.findFirst({
        where: { id: partyId, companyId },
      });
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
    }

    // Validate bank if provided
    if (bankId) {
      const bank = await prisma.bankAccount.findFirst({
        where: { id: bankId, companyId, isActive: true },
      });
      if (!bank) {
        return res.status(404).json({ error: 'Bank account not found' });
      }
    }

    // Validate invoice if provided
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, companyId },
      });
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      if (invoice.partyId !== partyId || invoice.partyType !== partyType) {
        return res.status(400).json({ error: 'Invoice party mismatch' });
      }
    }

    // Create payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.payment.create({
        data: {
          type: type as any,
          partyId,
          partyType: partyType as any,
          amount: Number(amount),
          paymentMode: paymentMode as any,
          referenceNumber: referenceNumber || null,
          chequeNumber: chequeNumber || null,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          bankId: bankId || null,
          invoiceId: invoiceId || null,
          notes: notes || null,
          date: new Date(date),
          companyId,
          createdBy: userId,
        },
        include: {
          bank: true,
          invoice: true,
        },
      });

      // Update party balance
      if (partyType === 'CUSTOMER') {
        const balanceChange = type === 'RECEIPT' ? -Number(amount) : Number(amount);
        await tx.customer.update({
          where: { id: partyId },
          data: {
            currentBalance: {
              increment: balanceChange,
            },
          },
        });
      } else {
        const balanceChange = type === 'PAYMENT' ? -Number(amount) : Number(amount);
        await tx.supplier.update({
          where: { id: partyId },
          data: {
            currentBalance: {
              increment: balanceChange,
            },
          },
        });
      }

      // Update bank balance if bank is provided
      if (bankId) {
        const bankBalanceChange = type === 'RECEIPT' ? Number(amount) : -Number(amount);
        await tx.bankAccount.update({
          where: { id: bankId },
          data: {
            currentBalance: {
              increment: bankBalanceChange,
            },
          },
        });
      }

      // Update invoice payment status if invoice is provided
      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            payments: true,
          },
        });

        if (invoice) {
          const totalPaid = invoice.payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          );
          const grandTotal = Number(invoice.grandTotal);
          const remaining = grandTotal - totalPaid - Number(amount);

          let paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
          if (remaining <= 0) {
            paymentStatus = 'PAID';
          } else if (totalPaid + Number(amount) > 0) {
            paymentStatus = 'PARTIAL';
          }

          await tx.invoice.update({
            where: { id: invoiceId },
            data: { paymentStatus },
          });
        }
      }

      return payment;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment' });
  }
};

// Update payment
export const updatePayment = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const {
      amount,
      paymentMode,
      referenceNumber,
      chequeNumber,
      chequeDate,
      bankId,
      notes,
      date,
    } = req.body;

    // Update payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      const oldPayment = await tx.payment.findUnique({
        where: { id: req.params.id },
      });

      if (!oldPayment) {
        throw new Error('Payment not found');
      }

      // Revert old balance changes
      if (oldPayment.partyType === 'CUSTOMER') {
        const oldBalanceChange = oldPayment.type === 'RECEIPT' ? Number(oldPayment.amount) : -Number(oldPayment.amount);
        await tx.customer.update({
          where: { id: oldPayment.partyId },
          data: {
            currentBalance: {
              increment: oldBalanceChange,
            },
          },
        });
      } else {
        const oldBalanceChange = oldPayment.type === 'PAYMENT' ? Number(oldPayment.amount) : -Number(oldPayment.amount);
        await tx.supplier.update({
          where: { id: oldPayment.partyId },
          data: {
            currentBalance: {
              increment: oldBalanceChange,
            },
          },
        });
      }

      // Revert old bank balance
      if (oldPayment.bankId) {
        const oldBankBalanceChange = oldPayment.type === 'RECEIPT' ? -Number(oldPayment.amount) : Number(oldPayment.amount);
        await tx.bankAccount.update({
          where: { id: oldPayment.bankId },
          data: {
            currentBalance: {
              increment: oldBankBalanceChange,
            },
          },
        });
      }

      // Update payment
      const updatedPayment = await tx.payment.update({
        where: { id: req.params.id },
        data: {
          amount: amount ? Number(amount) : undefined,
          paymentMode: paymentMode as any,
          referenceNumber: referenceNumber !== undefined ? referenceNumber : undefined,
          chequeNumber: chequeNumber !== undefined ? chequeNumber : undefined,
          chequeDate: chequeDate ? new Date(chequeDate) : undefined,
          bankId: bankId !== undefined ? bankId : undefined,
          notes: notes !== undefined ? notes : undefined,
          date: date ? new Date(date) : undefined,
        },
        include: {
          bank: true,
          invoice: true,
        },
      });

      // Apply new balance changes
      const newAmount = amount ? Number(amount) : Number(oldPayment.amount);
      if (updatedPayment.partyType === 'CUSTOMER') {
        const newBalanceChange = updatedPayment.type === 'RECEIPT' ? -newAmount : newAmount;
        await tx.customer.update({
          where: { id: updatedPayment.partyId },
          data: {
            currentBalance: {
              increment: newBalanceChange,
            },
          },
        });
      } else {
        const newBalanceChange = updatedPayment.type === 'PAYMENT' ? -newAmount : newAmount;
        await tx.supplier.update({
          where: { id: updatedPayment.partyId },
          data: {
            currentBalance: {
              increment: newBalanceChange,
            },
          },
        });
      }

      // Apply new bank balance
      if (updatedPayment.bankId) {
        const newBankBalanceChange = updatedPayment.type === 'RECEIPT' ? newAmount : -newAmount;
        await tx.bankAccount.update({
          where: { id: updatedPayment.bankId },
          data: {
            currentBalance: {
              increment: newBankBalanceChange,
            },
          },
        });
      }

      // Update invoice payment status if invoice exists
      if (updatedPayment.invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: updatedPayment.invoiceId },
          include: {
            payments: true,
          },
        });

        if (invoice) {
          const totalPaid = invoice.payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          );
          const grandTotal = Number(invoice.grandTotal);
          const remaining = grandTotal - totalPaid;

          let paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
          if (remaining <= 0) {
            paymentStatus = 'PAID';
          } else if (totalPaid > 0) {
            paymentStatus = 'PARTIAL';
          }

          await tx.invoice.update({
            where: { id: updatedPayment.invoiceId },
            data: { paymentStatus },
          });
        }
      }

      return updatedPayment;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Update payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to update payment' });
  }
};

// Delete payment
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Delete payment in transaction
    await prisma.$transaction(async (tx) => {
      // Revert balance changes
      if (payment.partyType === 'CUSTOMER') {
        const balanceChange = payment.type === 'RECEIPT' ? Number(payment.amount) : -Number(payment.amount);
        await tx.customer.update({
          where: { id: payment.partyId },
          data: {
            currentBalance: {
              increment: balanceChange,
            },
          },
        });
      } else {
        const balanceChange = payment.type === 'PAYMENT' ? Number(payment.amount) : -Number(payment.amount);
        await tx.supplier.update({
          where: { id: payment.partyId },
          data: {
            currentBalance: {
              increment: balanceChange,
            },
          },
        });
      }

      // Revert bank balance
      if (payment.bankId) {
        const bankBalanceChange = payment.type === 'RECEIPT' ? -Number(payment.amount) : Number(payment.amount);
        await tx.bankAccount.update({
          where: { id: payment.bankId },
          data: {
            currentBalance: {
              increment: bankBalanceChange,
            },
          },
        });
      }

      // Update invoice payment status
      if (payment.invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: payment.invoiceId },
          include: {
            payments: true,
          },
        });

        if (invoice) {
          const remainingPayments = invoice.payments.filter(p => p.id !== payment.id);
          const totalPaid = remainingPayments.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          );
          const grandTotal = Number(invoice.grandTotal);
          const remaining = grandTotal - totalPaid;

          let paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
          if (remaining <= 0) {
            paymentStatus = 'PAID';
          } else if (totalPaid > 0) {
            paymentStatus = 'PARTIAL';
          }

          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: { paymentStatus },
          });
        }
      }

      // Delete payment
      await tx.payment.delete({
        where: { id: req.params.id },
      });
    });

    res.json({ message: 'Payment deleted successfully' });
  } catch (error: any) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete payment' });
  }
};

// Get payment summary
export const getPaymentSummary = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const { fromDate, toDate } = req.query;

    const where: Prisma.PaymentWhereInput = {
      companyId,
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

    const [receipts, payments] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          ...where,
          type: 'RECEIPT',
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          ...where,
          type: 'PAYMENT',
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Get payments by mode
    const paymentsByMode = await prisma.payment.groupBy({
      by: ['paymentMode'],
      where,
      _sum: {
        amount: true,
      },
    });

    res.json({
      receipts: {
        total: Number(receipts._sum.amount || 0),
        count: receipts._count.id,
      },
      payments: {
        total: Number(payments._sum.amount || 0),
        count: payments._count.id,
      },
      net: Number(receipts._sum.amount || 0) - Number(payments._sum.amount || 0),
      byMode: paymentsByMode.map((item) => ({
        mode: item.paymentMode,
        total: Number(item._sum.amount || 0),
      })),
    });
  } catch (error: any) {
    console.error('Get payment summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment summary' });
  }
};
