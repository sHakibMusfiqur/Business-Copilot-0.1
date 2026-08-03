import type { Prisma, PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Enterprise RBAC permission catalog.
//
// Single source of truth for every permission in the platform. The seed script,
// the `db:sync-rbac` maintenance script, and the organization-creation flow all
// consume this file so the permission list is never duplicated.
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissionSeed {
  name: string;
  module: string;
  label: string;
}

export type DbClient = PrismaClient | Prisma.TransactionClient;

export const ACTION_LABELS: Record<string, string> = {
  read: 'View',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  import: 'Import',
  export: 'Export',
  print: 'Print',
  reports: 'Reports',
  ai: 'AI',
};

export const MODULE_LABELS: Record<string, string> = {
  users: 'Users',
  customers: 'Customers',
  suppliers: 'Suppliers',
  products: 'Products',
  inventory: 'Inventory',
  purchase: 'Purchases',
  sales: 'Sales',
  invoices: 'Invoices',
  employees: 'Employees',
  payroll: 'Payroll',
  crm: 'CRM',
  accounting: 'Accounting',
  payments: 'Payments',
  reports: 'Reports',
  dashboard: 'Dashboard',
  organization: 'Organization',
  settings: 'Settings',
  audit: 'Audit Logs',
  billing: 'Billing',
  ai: 'AI Copilot',
};

/**
 * Every business module and the full set of actions its permissions support:
 * Create, Read, Update, Delete, Approve, Reject, Import, Export, Print,
 * Reports, AI.
 */
export const MODULE_ACTIONS: Record<string, string[]> = {
  users: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  customers: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  suppliers: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  products: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  inventory: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  purchase: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  sales: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  invoices: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  employees: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  payroll: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  crm: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  accounting: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'import', 'export', 'print', 'reports', 'ai'],
  payments: ['read', 'create', 'update', 'delete', 'import', 'export', 'print', 'reports', 'ai'],
  reports: ['read', 'export', 'print', 'ai'],
  ai: ['read'],
};

/**
 * Module / action specific permissions that do not fit the generic action
 * matrix (granular sub-resources, workflow actions, or owner-only toggles).
 */
const EXTRA_PERMISSIONS: PermissionSeed[] = [
  { name: 'inventory.manage', module: 'inventory', label: 'Manage Inventory' },
  { name: 'inventory.adjust', module: 'inventory', label: 'Adjust Stock' },
  { name: 'purchase.receive', module: 'purchase', label: 'Receive Purchase Orders' },
  { name: 'sales.deliver', module: 'sales', label: 'Deliver Sales Orders' },
  { name: 'crm.activities', module: 'crm', label: 'Manage Activities' },
  { name: 'accounting.accounts.read', module: 'accounting', label: 'View Chart of Accounts' },
  { name: 'accounting.accounts.create', module: 'accounting', label: 'Create Accounts' },
  { name: 'accounting.accounts.update', module: 'accounting', label: 'Update Accounts' },
  { name: 'accounting.accounts.delete', module: 'accounting', label: 'Delete Accounts' },
  { name: 'accounting.journal.read', module: 'accounting', label: 'View Journal Entries' },
  { name: 'accounting.journal.create', module: 'accounting', label: 'Create Journal Entries' },
  { name: 'accounting.journal.post', module: 'accounting', label: 'Post Journal Entries' },
  { name: 'accounting.journal.delete', module: 'accounting', label: 'Delete Journal Entries' },
  { name: 'accounting.receivables.read', module: 'accounting', label: 'View Receivables' },
  { name: 'accounting.payables.read', module: 'accounting', label: 'View Payables' },
  { name: 'payments.read', module: 'payments', label: 'View Payments' },
  { name: 'payments.create', module: 'payments', label: 'Create Payments' },
  { name: 'reports.read', module: 'reports', label: 'View Reports' },
  { name: 'reports.finance', module: 'reports', label: 'View Financial Reports' },
  { name: 'dashboard.read', module: 'dashboard', label: 'View Dashboard' },
  { name: 'organization.manage', module: 'organization', label: 'Manage Organization' },
  { name: 'settings.manage', module: 'settings', label: 'Manage Settings' },
  { name: 'audit.read', module: 'audit', label: 'View Audit Logs' },
  { name: 'billing.read', module: 'billing', label: 'View Billing & Subscription' },
  { name: 'billing.manage', module: 'billing', label: 'Manage Subscription & Payment' },
  { name: 'ai.read', module: 'ai', label: 'Use AI Copilot' },
];

function buildActionPermissions(): PermissionSeed[] {
  const permissions: PermissionSeed[] = [];
  for (const [module, actions] of Object.entries(MODULE_ACTIONS)) {
    for (const action of actions) {
      permissions.push({
        name: `${module}.${action}`,
        module,
        label: `${ACTION_LABELS[action]} ${MODULE_LABELS[module]}`,
      });
    }
  }
  return permissions;
}

function dedupe(permissions: PermissionSeed[]): PermissionSeed[] {
  const seen = new Set<string>();
  return permissions.filter((perm) => {
    if (seen.has(perm.name)) return false;
    seen.add(perm.name);
    return true;
  });
}

export const SEED_PERMISSIONS: PermissionSeed[] = dedupe([
  ...EXTRA_PERMISSIONS,
  ...buildActionPermissions(),
]);

/**
 * Permissions assigned to the seeded "Admin" system role. Everything except
 * organization-level management (reserved for the Owner).
 */
export const ADMIN_PERMISSIONS: string[] = SEED_PERMISSIONS.map((p) => p.name).filter(
  (name) => name !== 'organization.manage',
);

export async function upsertPermissions(db: DbClient) {
  const results: Array<{ name: string; id: string }> = [];
  for (const perm of SEED_PERMISSIONS) {
    const created = await db.permission.upsert({
      where: { name: perm.name },
      update: { label: perm.label, module: perm.module },
      create: perm,
    });
    results.push({ name: created.name, id: created.id });
  }
  return results;
}

/**
 * Refreshes the Owner + Admin system roles of a single organization so they
 * reflect the full catalog (used by the seed and the sync script).
 */
export async function syncSystemRolesForOrg(
  db: DbClient,
  orgId: string,
): Promise<{ ownerRole: { id: string }; adminRole: { id: string } }> {
  const permissions = await upsertPermissions(db);
  const permissionIds = permissions.map((p) => p.id);
  const adminNameSet = new Set(ADMIN_PERMISSIONS);
  const adminPermissionIds = permissions
    .filter((p) => adminNameSet.has(p.name))
    .map((p) => p.id);

  const ownerRole = await db.role.upsert({
    where: { organizationId_name: { organizationId: orgId, name: 'Owner' } },
    update: {},
    create: {
      name: 'Owner',
      description: 'Full access to all organization features',
      isSystem: true,
      organizationId: orgId,
    },
  });

  await db.rolePermission.deleteMany({ where: { roleId: ownerRole.id } });
  if (permissionIds.length > 0) {
    await db.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: ownerRole.id, permissionId })),
    });
  }

  const adminRole = await db.role.upsert({
    where: { organizationId_name: { organizationId: orgId, name: 'Admin' } },
    update: {},
    create: {
      name: 'Admin',
      description: 'Administrative access with some restrictions',
      isSystem: true,
      organizationId: orgId,
    },
  });

  await db.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  if (adminPermissionIds.length > 0) {
    await db.rolePermission.createMany({
      data: adminPermissionIds.map((permissionId) => ({ roleId: adminRole.id, permissionId })),
    });
  }

  return { ownerRole, adminRole };
}

/** Refreshes Owner + Admin system roles for every active organization. */
export async function syncSystemRoles(db: DbClient): Promise<void> {
  const orgs = await db.organization.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  for (const org of orgs) {
    const { ownerRole, adminRole } = await syncSystemRolesForOrg(db, org.id);
    console.log(`  Synced Owner (${ownerRole.id}) and Admin (${adminRole.id}) for org ${org.id}`);
  }
}
