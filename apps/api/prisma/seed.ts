import { PrismaClient, UserRole, OrganizationMemberRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { upsertPermissions, syncSystemRolesForOrg } from '../src/rbac/permission-catalog';

const prisma = new PrismaClient();

// All seed account credentials are read from the environment. Missing values
// abort the seed with a clear message instead of silently creating accounts
// with weak, well-known passwords.
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const SEED_MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL;
const SEED_MANAGER_PASSWORD = process.env.SEED_MANAGER_PASSWORD;
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL;
const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD;
const SEED_SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL;
const SEED_SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD;

function requireSeedCredentials(): void {
  const required = [
    ['SEED_ADMIN_EMAIL', SEED_ADMIN_EMAIL],
    ['SEED_ADMIN_PASSWORD', SEED_ADMIN_PASSWORD],
    ['SEED_MANAGER_EMAIL', SEED_MANAGER_EMAIL],
    ['SEED_MANAGER_PASSWORD', SEED_MANAGER_PASSWORD],
    ['SEED_USER_EMAIL', SEED_USER_EMAIL],
    ['SEED_USER_PASSWORD', SEED_USER_PASSWORD],
    ['SEED_SUPER_ADMIN_EMAIL', SEED_SUPER_ADMIN_EMAIL],
    ['SEED_SUPER_ADMIN_PASSWORD', SEED_SUPER_ADMIN_PASSWORD],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Seed aborted: missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set them before running `npm run db:seed`.',
    );
  }
}

async function assignRolesToUser(userId: string, roleIds: string[]) {
  await prisma.userRoleAssignment.deleteMany({ where: { userId } });
  if (roleIds.length > 0) {
    await prisma.userRoleAssignment.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
    });
  }
}

async function main() {
  console.log('Seeding database...');
  requireSeedCredentials();

  const adminPassword = await argon2.hash(SEED_ADMIN_PASSWORD as string);
  const userPassword = await argon2.hash(SEED_USER_PASSWORD as string);
  const managerPassword = await argon2.hash(SEED_MANAGER_PASSWORD as string);
  const superAdminPassword = await argon2.hash(SEED_SUPER_ADMIN_PASSWORD as string);

  // ─── Organization ──────────────────────────────────────────────

  const org = await prisma.organization.upsert({
    where: { name: 'Acme Corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
    },
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  // ─── Users ─────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL as string },
    update: { organizationId: org.id },
    create: {
      email: SEED_ADMIN_EMAIL as string,
      password: adminPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      isActive: true,
      organizationId: org.id,
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    update: { role: OrganizationMemberRole.OWNER },
    create: {
      organizationId: org.id,
      userId: admin.id,
      role: OrganizationMemberRole.OWNER,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: SEED_MANAGER_EMAIL as string },
    update: { organizationId: org.id },
    create: {
      email: SEED_MANAGER_EMAIL as string,
      password: managerPassword,
      name: 'Manager User',
      role: UserRole.MANAGER,
      isActive: true,
      organizationId: org.id,
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: manager.id } },
    update: { role: OrganizationMemberRole.MEMBER },
    create: {
      organizationId: org.id,
      userId: manager.id,
      role: OrganizationMemberRole.MEMBER,
    },
  });

  const regularUser = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL as string },
    update: { organizationId: org.id },
    create: {
      email: SEED_USER_EMAIL as string,
      password: userPassword,
      name: 'Regular User',
      role: UserRole.USER,
      isActive: true,
      organizationId: org.id,
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: regularUser.id } },
    update: { role: OrganizationMemberRole.MEMBER },
    create: {
      organizationId: org.id,
      userId: regularUser.id,
      role: OrganizationMemberRole.MEMBER,
    },
  });

  console.log('Users created (passwords come from environment variables):');
  console.log(`  Admin:    ${SEED_ADMIN_EMAIL}`);
  console.log(`  Manager:  ${SEED_MANAGER_EMAIL}`);
  console.log(`  User:     ${SEED_USER_EMAIL}`);

  // ─── RBAC ──────────────────────────────────────────────────────

  console.log('Seeding RBAC...');
  const permissions = await upsertPermissions(prisma);
  console.log(`  Permissions: ${permissions.length} seeded`);

  const { ownerRole, adminRole } = await syncSystemRolesForOrg(prisma, org.id);
  console.log(`  Role: Owner (${ownerRole.id})`);
  console.log(`  Role: Admin (${adminRole.id})`);

  await assignRolesToUser(admin.id, [ownerRole.id]);
  console.log(`  Assigned Owner role to ${admin.email}`);

  await assignRolesToUser(manager.id, [adminRole.id]);
  console.log(`  Assigned Admin role to ${manager.email}`);

  await assignRolesToUser(regularUser.id, []);
  console.log(`  User ${regularUser.email} has no assigned roles`);

  // ─── Categories ────────────────────────────────────────────────

  await Promise.all([
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

  // ─── Chart of Accounts ────────────────────────────────────────

  const accountUpserts = [
    { code: '1000', name: 'Cash', type: 'ASSET' as const },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' as const },
    { code: '1200', name: 'Inventory', type: 'ASSET' as const },
    { code: '1300', name: 'Fixed Assets', type: 'ASSET' as const },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' as const },
    { code: '2100', name: 'Accrued Liabilities', type: 'LIABILITY' as const },
    { code: '3000', name: 'Owner\'s Equity', type: 'EQUITY' as const },
    { code: '4000', name: 'Revenue', type: 'REVENUE' as const },
    { code: '4100', name: 'Sales Discounts', type: 'REVENUE' as const },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' as const },
    { code: '6000', name: 'Operating Expenses', type: 'EXPENSE' as const },
    { code: '7000', name: 'Other Income', type: 'REVENUE' as const },
  ];

  await Promise.all(
    accountUpserts.map((a) =>
      prisma.account.upsert({
        where: { organizationId_code: { organizationId: org.id, code: a.code } },
        update: {},
        create: { ...a, organizationId: org.id },
      }),
    ),
  );

  console.log('Chart of Accounts created');

  // ─── Departments ───────────────────────────────────────────────

  await Promise.all([
    prisma.department.upsert({ where: { code: 'ENG' }, update: {}, create: { code: 'ENG', name: 'Engineering' } }),
    prisma.department.upsert({ where: { code: 'SALES' }, update: {}, create: { code: 'SALES', name: 'Sales' } }),
    prisma.department.upsert({ where: { code: 'HR' }, update: {}, create: { code: 'HR', name: 'Human Resources' } }),
    prisma.department.upsert({ where: { code: 'FIN' }, update: {}, create: { code: 'FIN', name: 'Finance' } }),
  ]);

  console.log('Departments created');

  // ─── Platform Admin ────────────────────────────────────────────

  await prisma.user.upsert({
    where: { email: SEED_SUPER_ADMIN_EMAIL as string },
    update: {},
    create: {
      email: SEED_SUPER_ADMIN_EMAIL as string,
      name: 'Super Admin',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`  Super Admin: ${SEED_SUPER_ADMIN_EMAIL}`);

  // ─── Subscription Plans ────────────────────────────────────────

  const PLAN_SEEDS: Array<Record<string, unknown>> = [
    {
      slug: 'free',
      name: 'Free',
      description: 'For small teams getting started',
      price: 0,
      yearlyPrice: 0,
      freeTrialDays: 30,
      maxUsers: 5,
      maxCustomers: 50,
      maxProducts: 50,
      maxStorage: 512,
      sortOrder: 1,
      recommended: false,
      modules: ['invoicing', 'expenses', 'basicReports'],
      integrations: [],
      securityFeatures: [],
      features: { invoicing: true, expenses: true, basicReports: true },
    },
    {
      slug: 'starter',
      name: 'Starter',
      description: 'For growing businesses',
      price: 29,
      yearlyPrice: 290,
      freeTrialDays: 30,
      aiCredits: 500,
      maxUsers: 15,
      maxCustomers: 500,
      maxProducts: 500,
      maxStorage: 2048,
      sortOrder: 2,
      recommended: false,
      reportsEnabled: true,
      modules: ['invoicing', 'expenses', 'reports', 'inventory', 'crm'],
      integrations: ['import/export'],
      securityFeatures: ['2FA'],
      features: { invoicing: true, expenses: true, reports: true, inventory: true, crm: true },
    },
    {
      slug: 'growth',
      name: 'Growth',
      description: 'For teams that need advanced tools',
      price: 79,
      yearlyPrice: 790,
      freeTrialDays: 30,
      aiCredits: 2000,
      maxUsers: 50,
      maxCustomers: 5000,
      maxProducts: 5000,
      maxStorage: 10240,
      sortOrder: 3,
      recommended: true,
      reportsEnabled: true,
      apiAccess: true,
      prioritySupport: true,
      modules: ['invoicing', 'expenses', 'reports', 'inventory', 'crm', 'api', 'advancedReports'],
      integrations: ['import/export', 'email sync', 'slack'],
      securityFeatures: ['2FA', 'advanced audit'],
      features: { all: true, api: true, advancedReports: true, multipleWarehouses: true, prioritySupport: true },
    },
    {
      slug: 'professional',
      name: 'Professional',
      description: 'For established companies',
      price: 149,
      yearlyPrice: 1490,
      freeTrialDays: 30,
      aiCredits: 5000,
      maxUsers: 200,
      maxCustomers: 50000,
      maxProducts: 50000,
      maxStorage: 51200,
      sortOrder: 4,
      recommended: false,
      reportsEnabled: true,
      apiAccess: true,
      prioritySupport: true,
      customBranding: true,
      modules: ['invoicing', 'expenses', 'reports', 'inventory', 'crm', 'api', 'advancedReports', 'multiWarehouse'],
      integrations: ['import/export', 'email sync', 'slack', 'quickbooks', 'xero'],
      securityFeatures: ['2FA', 'advanced audit', 'SSO'],
      features: { all: true, api: true, advancedReports: true, multipleWarehouses: true, customBranding: true, sso: true },
    },
    {
      slug: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations',
      price: 299,
      yearlyPrice: 2990,
      freeTrialDays: 30,
      aiCredits: 20000,
      maxUsers: 999,
      maxCustomers: 999999,
      maxProducts: 999999,
      maxStorage: 102400,
      sortOrder: 5,
      recommended: false,
      reportsEnabled: true,
      apiAccess: true,
      prioritySupport: true,
      customBranding: true,
      modules: ['invoicing', 'expenses', 'reports', 'inventory', 'crm', 'api', 'advancedReports', 'multiWarehouse'],
      integrations: ['import/export', 'email sync', 'slack', 'quickbooks', 'xero', 'custom integrations'],
      securityFeatures: ['2FA', 'advanced audit', 'SSO', 'SLA'],
      features: { all: true, api: true, dedicatedSupport: true, customIntegrations: true, sso: true, sla: true },
    },
  ];

  for (const plan of PLAN_SEEDS) {
    const { slug, ...data } = plan;
    await prisma.subscriptionPlan.upsert({
      where: { slug: slug as string },
      update: data,
      create: plan as never,
    });
  }

  console.log('Subscription Plans created');

  // ─── Payment Gateways ──────────────────────────────────────────

  const GATEWAYS = [
    { code: 'stripe', name: 'Stripe (Cards)', sortOrder: 1 },
    { code: 'sslcommerz', name: 'SSLCommerz', sortOrder: 2 },
    { code: 'bkash', name: 'bKash', sortOrder: 3 },
    { code: 'nagad', name: 'Nagad', sortOrder: 4 },
    { code: 'paypal', name: 'PayPal', sortOrder: 5 },
    { code: 'card', name: 'Card', sortOrder: 6 },
  ];

  for (const gateway of GATEWAYS) {
    await prisma.paymentGateway.upsert({
      where: { code: gateway.code },
      update: {},
      create: { ...gateway, isEnabled: false },
    });
  }

  console.log('Payment Gateways created');
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
