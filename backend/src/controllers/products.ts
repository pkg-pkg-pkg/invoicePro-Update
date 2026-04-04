import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

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

export const getProducts = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      page = '1',
      limit = '50',
      search = '',
      category = '',
      lowStock = 'false',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      companyId,
      isActive: true,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category) {
      where.categoryId = category as string;
    }

    // Low stock filter
    if (lowStock === 'true') {
      where.currentStock = {
        lte: prisma.product.fields.lowStockAlert
      };
    }

    // Sort
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'code') {
      orderBy.code = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'salePrice') {
      orderBy.salePrice = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'currentStock') {
      orderBy.currentStock = sortOrder as 'asc' | 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Fetch products
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        skip,
        take: limitNum,
        orderBy,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch products' });
  }
};

export const getProduct = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error: any) {
    console.error('Get product error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch product' });
  }
};

export const getProductByBarcode = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { barcode } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        barcode,
        companyId,
        isActive: true,
      },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error: any) {
    console.error('Get product by barcode error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch product' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    
    const {
      name,
      code,
      barcode,
      categoryId,
      hsnCode,
      sacCode,
      unit,
      uqc,
      purchasePrice,
      salePrice,
      mrp,
      wholesalePrice,
      distributorPrice,
      openingStock,
      currentStock,
      lowStockAlert,
      trackBatch,
      trackSerial,
      trackExpiry,
      images,
      isActive = true,
    } = req.body;

    // Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Product name is required (min 2 characters)' });
    }

    if (!unit) {
      return res.status(400).json({ error: 'Unit is required' });
    }

    if (purchasePrice < 0 || salePrice < 0 || (mrp && mrp < 0)) {
      return res.status(400).json({ error: 'Prices must be >= 0' });
    }

    if (openingStock < 0 || (currentStock !== undefined && currentStock < 0)) {
      return res.status(400).json({ error: 'Stock must be >= 0' });
    }

    // Check duplicate code
    if (code) {
      const existing = await prisma.product.findFirst({
        where: {
          companyId,
          code,
          isActive: true,
        },
      });
      if (existing) {
        return res.status(400).json({ error: 'Product code already exists' });
      }
    }

    // Check duplicate barcode
    if (barcode) {
      const existing = await prisma.product.findFirst({
        where: {
          companyId,
          barcode,
          isActive: true,
        },
      });
      if (existing) {
        return res.status(400).json({ error: 'Barcode already exists' });
      }
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        code: code?.trim() || `PROD-${Date.now()}`,
        barcode: barcode?.trim() || null,
        categoryId: categoryId || null,
        hsnCode: hsnCode?.trim() || null,
        sacCode: sacCode?.trim() || null,
        unit,
        uqc: uqc || null,
        purchasePrice: purchasePrice || 0,
        salePrice: salePrice || 0,
        mrp: mrp || null,
        wholesalePrice: wholesalePrice || null,
        distributorPrice: distributorPrice || null,
        openingStock: openingStock || 0,
        currentStock: currentStock !== undefined ? currentStock : (openingStock || 0),
        lowStockAlert: lowStockAlert || 0,
        trackBatch: trackBatch || false,
        trackSerial: trackSerial || false,
        trackExpiry: trackExpiry || false,
        images: images || [],
        companyId,
        isActive,
      },
      include: { category: true },
    });

    res.status(201).json(product);
  } catch (error: any) {
    console.error('Create product error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate product code or barcode' });
    }
    res.status(500).json({ error: error.message || 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    // Check if product exists and belongs to company
    const existing = await prisma.product.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const {
      name,
      code,
      barcode,
      categoryId,
      hsnCode,
      sacCode,
      unit,
      uqc,
      purchasePrice,
      salePrice,
      mrp,
      wholesalePrice,
      distributorPrice,
      lowStockAlert,
      trackBatch,
      trackSerial,
      trackExpiry,
      images,
      isActive,
    } = req.body;

    // Validation
    if (name && name.trim().length < 2) {
      return res.status(400).json({ error: 'Product name must be at least 2 characters' });
    }

    if (purchasePrice !== undefined && purchasePrice < 0) {
      return res.status(400).json({ error: 'Purchase price must be >= 0' });
    }

    if (salePrice !== undefined && salePrice < 0) {
      return res.status(400).json({ error: 'Sale price must be >= 0' });
    }

    // Check duplicate code (excluding current product)
    if (code && code !== existing.code) {
      const duplicate = await prisma.product.findFirst({
        where: {
          companyId,
          code,
          isActive: true,
          NOT: { id },
        },
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Product code already exists' });
      }
    }

    // Check duplicate barcode (excluding current product)
    if (barcode && barcode !== existing.barcode) {
      const duplicate = await prisma.product.findFirst({
        where: {
          companyId,
          barcode,
          isActive: true,
          NOT: { id },
        },
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Barcode already exists' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(barcode !== undefined && { barcode: barcode?.trim() || null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(hsnCode !== undefined && { hsnCode: hsnCode?.trim() || null }),
        ...(sacCode !== undefined && { sacCode: sacCode?.trim() || null }),
        ...(unit && { unit }),
        ...(uqc !== undefined && { uqc: uqc || null }),
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(salePrice !== undefined && { salePrice }),
        ...(mrp !== undefined && { mrp: mrp || null }),
        ...(wholesalePrice !== undefined && { wholesalePrice: wholesalePrice || null }),
        ...(distributorPrice !== undefined && { distributorPrice: distributorPrice || null }),
        ...(lowStockAlert !== undefined && { lowStockAlert }),
        ...(trackBatch !== undefined && { trackBatch }),
        ...(trackSerial !== undefined && { trackSerial }),
        ...(trackExpiry !== undefined && { trackExpiry }),
        ...(images !== undefined && { images }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });

    res.json(product);
  } catch (error: any) {
    console.error('Update product error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Duplicate product code or barcode' });
    }
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id, companyId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete product' });
  }
};

export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const products = await prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        currentStock: {
          lte: prisma.product.fields.lowStockAlert
        },
      },
      include: { category: true },
      orderBy: { currentStock: 'asc' },
    });

    res.json(products);
  } catch (error: any) {
    console.error('Get low stock products error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch low stock products' });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);

    const categories = await prisma.category.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch categories' });
  }
};

export const bulkUpdateStock = async (req: Request, res: Response) => {
  try {
    const companyId = await getUserCompanyId(req.user!.id);
    const { updates } = req.body; // Array of { id, currentStock }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Updates array is required' });
    }

    // Validate all products belong to company
    const productIds = updates.map((u: any) => u.id);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        companyId,
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'Some products not found or do not belong to your company' });
    }

    // Update in transaction
    const result = await prisma.$transaction(
      updates.map((update: any) =>
        prisma.product.update({
          where: { id: update.id },
          data: { currentStock: update.currentStock },
        })
      )
    );

    res.json({ message: 'Stock updated successfully', updated: result.length });
  } catch (error: any) {
    console.error('Bulk update stock error:', error);
    res.status(500).json({ error: error.message || 'Failed to update stock' });
  }
};

export const bulkImport = async (req: Request, res: Response) => {
  // Implement bulk import from Excel/CSV
  res.json({ message: 'Bulk import not implemented yet' });
};

