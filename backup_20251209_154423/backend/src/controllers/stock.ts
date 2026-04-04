import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStockMovements = async (req: Request, res: Response) => {
  try {
    const movements = await prisma.stockMovement.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};

export const getStockSummary = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        currentStock: true,
        salePrice: true
      }
    });
    
    const summary = products.map(p => ({
      productId: p.id,
      productName: p.name,
      quantity: p.currentStock,
      value: Number(p.currentStock) * Number(p.salePrice)
    }));
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock summary' });
  }
};

export const adjustStock = async (req: Request, res: Response) => {
  try {
    const { productId, quantity, type, notes } = req.body;
    
    // Create stock movement
    const movement = await prisma.stockMovement.create({
      data: {
        productId,
        quantity,
        type,
        rate: 0,
        notes,
        createdBy: req.body.userId
      }
    });
    
    // Update product stock
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (product) {
      const newStock = type === 'ADJUSTMENT' 
        ? Number(product.currentStock) + Number(quantity)
        : Number(product.currentStock) - Number(quantity);
      
      await prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock }
      });
    }
    
    res.json(movement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};

export const getLowStockItems = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: {
          lte: prisma.product.fields.lowStockAlert
        }
      }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
};

