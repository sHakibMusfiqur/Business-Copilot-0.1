import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const userPassword = await bcrypt.hash('User1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@business-copilot.com' },
    update: {},
    create: {
      email: 'admin@business-copilot.com',
      password: adminPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@business-copilot.com' },
    update: {},
    create: {
      email: 'manager@business-copilot.com',
      password: userPassword,
      name: 'Manager User',
      role: UserRole.MANAGER,
      isActive: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@business-copilot.com' },
    update: {},
    create: {
      email: 'user@business-copilot.com',
      password: userPassword,
      name: 'Regular User',
      role: UserRole.USER,
      isActive: true,
    },
  });

  console.log('Users created:');
  console.log(`  Admin:    admin@business-copilot.com / Admin123!`);
  console.log(`  Manager:  manager@business-copilot.com / User1234!`);
  console.log(`  User:     user@business-copilot.com / User1234!`);

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-electronics' },
      update: {},
      create: { id: 'cat-electronics', name: 'Electronics', description: 'Electronic devices and accessories' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-office' },
      update: {},
      create: { id: 'cat-office', name: 'Office Supplies', description: 'Office and stationery items' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-clothing' },
      update: {},
      create: { id: 'cat-clothing', name: 'Clothing', description: 'Apparel and fashion items' },
    }),
  ]);

  console.log('Categories created');

  const chartAccounts = await Promise.all([
    prisma.chartOfAccount.upsert({ where: { code: '1000' }, update: {}, create: { code: '1000', name: 'Cash', type: 'ASSET' } }),
    prisma.chartOfAccount.upsert({ where: { code: '2000' }, update: {}, create: { code: '2000', name: 'Accounts Receivable', type: 'ASSET' } }),
    prisma.chartOfAccount.upsert({ where: { code: '3000' }, update: {}, create: { code: '3000', name: 'Inventory', type: 'ASSET' } }),
    prisma.chartOfAccount.upsert({ where: { code: '4000' }, update: {}, create: { code: '4000', name: 'Revenue', type: 'REVENUE' } }),
    prisma.chartOfAccount.upsert({ where: { code: '5000' }, update: {}, create: { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' } }),
    prisma.chartOfAccount.upsert({ where: { code: '6000' }, update: {}, create: { code: '6000', name: 'Operating Expenses', type: 'EXPENSE' } }),
  ]);

  console.log('Chart of Accounts created');

  const departments = await Promise.all([
    prisma.department.upsert({ where: { code: 'ENG' }, update: {}, create: { code: 'ENG', name: 'Engineering' } }),
    prisma.department.upsert({ where: { code: 'SALES' }, update: {}, create: { code: 'SALES', name: 'Sales' } }),
    prisma.department.upsert({ where: { code: 'HR' }, update: {}, create: { code: 'HR', name: 'Human Resources' } }),
    prisma.department.upsert({ where: { code: 'FIN' }, update: {}, create: { code: 'FIN', name: 'Finance' } }),
  ]);

  console.log('Departments created');
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
