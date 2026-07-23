import { PrismaClient, UserRole, OrganizationMemberRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SEED_PERMISSIONS = [
  { name: 'users.read', module: 'users', label: 'View Users' },
  { name: 'users.create', module: 'users', label: 'Create Users' },
  { name: 'users.update', module: 'users', label: 'Update Users' },
  { name: 'users.delete', module: 'users', label: 'Delete Users' },
  { name: 'customers.read', module: 'customers', label: 'View Customers' },
  { name: 'customers.create', module: 'customers', label: 'Create Customers' },
  { name: 'customers.update', module: 'customers', label: 'Update Customers' },
  { name: 'customers.delete', module: 'customers', label: 'Delete Customers' },
  { name: 'suppliers.read', module: 'suppliers', label: 'View Suppliers' },
  { name: 'suppliers.create', module: 'suppliers', label: 'Create Suppliers' },
  { name: 'suppliers.update', module: 'suppliers', label: 'Update Suppliers' },
  { name: 'suppliers.delete', module: 'suppliers', label: 'Delete Suppliers' },
  { name: 'products.read', module: 'products', label: 'View Products' },
  { name: 'products.create', module: 'products', label: 'Create Products' },
  { name: 'products.update', module: 'products', label: 'Update Products' },
  { name: 'products.delete', module: 'products', label: 'Delete Products' },
  { name: 'inventory.read', module: 'inventory', label: 'View Inventory' },
  { name: 'inventory.manage', module: 'inventory', label: 'Manage Inventory' },
  { name: 'purchase.read', module: 'purchase', label: 'View Purchase Orders' },
  { name: 'purchase.create', module: 'purchase', label: 'Create Purchase Orders' },
  { name: 'sales.read', module: 'sales', label: 'View Sales Orders' },
  { name: 'sales.create', module: 'sales', label: 'Create Sales Orders' },
  { name: 'reports.read', module: 'reports', label: 'View Reports' },
  { name: 'dashboard.read', module: 'dashboard', label: 'View Dashboard' },
  { name: 'organization.manage', module: 'organization', label: 'Manage Organization' },
  { name: 'settings.manage', module: 'settings', label: 'Manage Settings' },
];

const ADMIN_PERMISSIONS = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'customers.read',
  'customers.create',
  'customers.update',
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'products.read',
  'products.create',
  'products.update',
  'inventory.read',
  'inventory.manage',
  'purchase.read',
  'purchase.create',
  'sales.read',
  'sales.create',
  'reports.read',
  'dashboard.read',
  'settings.manage',
];

async function seedPermissions() {
  const results: Array<{ name: string; id: string }> = [];
  for (const perm of SEED_PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { label: perm.label, module: perm.module },
      create: perm,
    });
    results.push({ name: created.name, id: created.id });
  }
  console.log(`  Permissions: ${results.length} seeded`);
  return results;
}

async function seedRoles(orgId: string, permissionIds: string[], adminPermissionIds: string[]) {
  const ownerRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: orgId, name: 'Owner' } },
    update: {},
    create: {
      name: 'Owner',
      description: 'Full access to all organization features',
      isSystem: true,
      organizationId: orgId,
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: ownerRole.id } });
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: ownerRole.id,
        permissionId,
      })),
    });
  }
  console.log(`  Role: Owner (${ownerRole.id}) — ${permissionIds.length} permissions`);

  const adminRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: orgId, name: 'Admin' } },
    update: {},
    create: {
      name: 'Admin',
      description: 'Administrative access with some restrictions',
      isSystem: true,
      organizationId: orgId,
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  if (adminPermissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: adminPermissionIds.map((permissionId) => ({
        roleId: adminRole.id,
        permissionId,
      })),
    });
  }
  console.log(`  Role: Admin (${adminRole.id}) — ${adminPermissionIds.length} permissions`);

  return { ownerRole, adminRole };
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

  const adminPassword = await argon2.hash('Admin123!');
  const userPassword = await argon2.hash('User1234!');

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
    where: { email: 'admin@business-copilot.com' },
    update: { organizationId: org.id },
    create: {
      email: 'admin@business-copilot.com',
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
    where: { email: 'manager@business-copilot.com' },
    update: { organizationId: org.id },
    create: {
      email: 'manager@business-copilot.com',
      password: userPassword,
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
    where: { email: 'user@business-copilot.com' },
    update: { organizationId: org.id },
    create: {
      email: 'user@business-copilot.com',
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

  console.log('Users created:');
  console.log(`  Admin:    admin@business-copilot.com / Admin123!`);
  console.log(`  Manager:  manager@business-copilot.com / User1234!`);
  console.log(`  User:     user@business-copilot.com / User1234!`);

  // ─── RBAC ──────────────────────────────────────────────────────

  console.log('Seeding RBAC...');
  const permissions = await seedPermissions();
  const permissionMap = new Map(permissions.map((p) => [p.name, p.id]));
  const allPermissionIds = permissions.map((p) => p.id);
  const adminPermissionIds = ADMIN_PERMISSIONS.map((name) => permissionMap.get(name)!).filter(Boolean);

  const { ownerRole, adminRole } = await seedRoles(org.id, allPermissionIds, adminPermissionIds);

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

  await Promise.all([
    prisma.chartOfAccount.upsert({ where: { code: '1000' }, update: {}, create: { code: '1000', name: 'Cash', type: 'ASSET' } }),
    prisma.chartOfAccount.upsert({ where: { code: '2000' }, update: {}, create: { code: '2000', name: 'Accounts Receivable', type: 'ASSET' } }),
    prisma.chartOfAccount.upsert({ where: { code: '3000' }, update: {}, create: { code: '3000', name: 'Inventory', type: 'ASSET' } }),
    prisma.chartOfAccount.upsert({ where: { code: '4000' }, update: {}, create: { code: '4000', name: 'Revenue', type: 'REVENUE' } }),
    prisma.chartOfAccount.upsert({ where: { code: '5000' }, update: {}, create: { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' } }),
    prisma.chartOfAccount.upsert({ where: { code: '6000' }, update: {}, create: { code: '6000', name: 'Operating Expenses', type: 'EXPENSE' } }),
  ]);

  console.log('Chart of Accounts created');

  // ─── Departments ───────────────────────────────────────────────

  await Promise.all([
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
