import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create or update company (using gstin as unique identifier)
  const company = await prisma.company.upsert({
    where: { gstin: '29ABCDE1234F1Z5' },
    update: {},
    create: {
      name: 'Demo Company',
      gstin: '29ABCDE1234F1Z5',
      addressLine1: '123 Business Street',
      addressLine2: 'Near City Center',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      pincode: '400001',
      phone: '9876543210',
      email: 'demo@example.com',
    },
  });
  console.log('✅ Company:', company.name);

  // Create or update admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      role: 'ADMIN',
      fullName: 'Admin User',
      companyId: company.id,
    },
  });
  console.log('✅ Admin user:', adminUser.username);
  console.log('   Username: admin');
  console.log('   Password: admin123');

  // Create or update category (find first, then create if not exists)
  let category = await prisma.category.findFirst({
    where: {
      companyId: company.id,
      name: 'Electronics',
    },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Electronics',
        companyId: company.id,
      },
    });
  }
  console.log('✅ Category:', category.name);

  // Create or update products
  const products = [
    {
      code: 'PROD001',
      name: 'Laptop',
      hsnCode: '8471',
      unit: 'PCS',
      purchasePrice: 45000,
      salePrice: 50000,
      mrp: 55000,
      openingStock: 10,
      currentStock: 10,
      companyId: company.id,
      categoryId: category.id,
    },
    {
      code: 'PROD002',
      name: 'Mouse',
      hsnCode: '8471',
      unit: 'PCS',
      purchasePrice: 400,
      salePrice: 500,
      mrp: 600,
      openingStock: 50,
      currentStock: 50,
      companyId: company.id,
      categoryId: category.id,
    },
  ];

  for (const productData of products) {
    const product = await prisma.product.upsert({
      where: {
        companyId_code: {
          companyId: productData.companyId,
          code: productData.code,
        },
      },
      update: productData,
      create: productData,
    });
    console.log('✅ Product:', product.name);
  }

  // Create or update customer
  const customer = await prisma.customer.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'CUST001',
      },
    },
    update: {},
    create: {
      code: 'CUST001',
      name: 'Sample Customer',
      gstin: '29XYZTE1234F1Z5',
      addressLine1: '456 Customer Lane',
      addressLine2: 'Suite 101',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400002',
      phone: '9876543211',
      email: 'customer@example.com',
      companyId: company.id,
    },
  });
  console.log('✅ Customer:', customer.name);

  console.log('✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });