// load-tests/data/seed-performance-users.js
// Seed performance test users into the database.
// Usage: npx ts-node seed-performance-users.js [count]
//
// This script creates test users and organizations for load testing.
// It is SEPARATE from normal seed data — never mixed with production seeds.
//
// Safety:
// - Creates users with @loadtest.local domain (easy to identify/cleanup)
// - Creates organizations with "Load Test" prefix
// - All data prefixed with "PERF-" for easy identification
// - Reversible: run with --cleanup flag to remove all test data

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const BATCH_SIZE = 50;

const args = process.argv.slice(2);
const CLEANUP = args.includes('--cleanup');
const COUNT = parseInt(args.find(a => /^\d+$/.test(a)) || '100', 10);
const PASSWORD = 'LoadTest@123';

const INDUSTRIES = [
  'restaurant', 'hospital', 'manufacturing', 'school',
  'software', 'retail', 'pharmacy', 'garments',
  'it-services', 'general',
];

const PERMISSIONS = [
  'employee.read', 'employee.create', 'employee.update', 'employee.delete',
  'customer.read', 'customer.create', 'customer.update', 'customer.delete',
  'product.read', 'product.create', 'product.update', 'product.delete',
  'sales.read', 'sales.create', 'sales.update', 'sales.delete',
  'payroll.read', 'payroll.create',
  'leave.read', 'leave.create', 'leave.update',
  'invoice.read', 'invoice.create',
  'purchase.read', 'purchase.create',
  'dashboard.read',
];

const ROLE_NAMES = ['Owner', 'Manager', 'Accountant', 'HR', 'Viewer'];

async function cleanup() {
  console.log('Cleaning up performance test data...');
  await prisma.auditLog.deleteMany({ where: { userId: { contains: 'loadtest' } } });
  await prisma.userRole.deleteMany({ where: { user: { email: { contains: '@loadtest' } } } });
  await prisma.role.deleteMany({ where: { name: { contains: 'PERF-' } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@loadtest' } } });
  await prisma.organization.deleteMany({ where: { name: { contains: 'PERF-' } } });
  console.log('Cleanup complete.');
}

async function seed() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const orgCount = Math.ceil(COUNT / 10);
  let userCount = 0;

  console.log(`Seeding ${COUNT} users across ${orgCount} organizations...`);

  for (let orgIdx = 0; orgIdx < orgCount; orgIdx++) {
    const orgName = `PERF-Organization-${String(orgIdx + 1).padStart(4, '0')}`;
    const industry = INDUSTRIES[orgIdx % INDUSTRIES.length];

    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: `perf-org-${orgIdx + 1}`,
        isActive: true,
        settings: {
          create: {
            industry,
            settings: {
              industry,
              enabledModules: ['employees', 'customers', 'products', 'sales', 'payroll', 'leaves', 'finance', 'purchases'],
            },
          },
        },
      },
    });

    // Create roles for this org
    const roles = {};
    for (const roleName of ROLE_NAMES) {
      const role = await prisma.role.create({
        data: {
          name: `PERF-${roleName}-${orgIdx + 1}`,
          organizationId: org.id,
          permissions: { set: PERMISSIONS.slice(0, roleName === 'Viewer' ? 4 : undefined) },
        },
      });
      roles[roleName] = role;
    }

    // Create 10 users per org
    const usersPerOrg = Math.min(10, COUNT - userCount);
    for (let u = 0; u < usersPerOrg; u++) {
      const email = `loaduser-${userCount + 1}@loadtest.local`;
      const role = u === 0 ? 'Owner' : ROLE_NAMES[u % ROLE_NAMES.length];

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: 'Load',
          lastName: `User${userCount + 1}`,
          emailVerified: true,
          isActive: true,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roles[role].id,
          organizationId: org.id,
        },
      });

      userCount++;
    }

    if ((orgIdx + 1) % 10 === 0) {
      console.log(`  Created ${orgIdx + 1}/${orgCount} organizations (${userCount} users)`);
    }
  }

  console.log(`\nSeed complete: ${userCount} users, ${orgCount} organizations`);
  console.log(`Login with: loaduser-1@loadtest.local / ${PASSWORD}`);
}

async function main() {
  try {
    if (CLEANUP) {
      await cleanup();
    } else {
      await seed();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
