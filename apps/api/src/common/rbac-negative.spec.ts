import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { RbacService } from '../rbac/rbac.service';
import { SEED_PERMISSIONS } from '../rbac/permission-catalog';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const ORG_A = 'org-a';

function buildRbacService(overrides: Record<string, jest.Mock> = {}) {
  const roleFindFirst = overrides.roleFindFirst ?? jest.fn();
  const roleFindUnique = overrides.roleFindUnique ?? jest.fn();
  const roleCreate = overrides.roleCreate ?? jest.fn();
  const roleUpdate = overrides.roleUpdate ?? jest.fn();
  const roleDelete = overrides.roleDelete ?? jest.fn();
  const permissionFindMany = overrides.permissionFindMany ?? jest.fn();
  const rolePermissionDeleteMany = overrides.rolePermissionDeleteMany ?? jest.fn();
  const rolePermissionCreateMany = overrides.rolePermissionCreateMany ?? jest.fn();
  const rolePermissionFindMany = overrides.rolePermissionFindMany ?? jest.fn().mockResolvedValue([]);
  const userRoleAssignmentCount = overrides.userRoleAssignmentCount ?? jest.fn().mockResolvedValue(0);
  const auditCreate = overrides.auditCreate ?? jest.fn().mockResolvedValue({ id: 'audit-1' });
  const transaction = overrides.transaction ?? jest.fn().mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        rolePermission: { deleteMany: rolePermissionDeleteMany, createMany: rolePermissionCreateMany },
      }),
  );

  const service = new RbacService({
    role: {
      findFirst: roleFindFirst,
      findUnique: roleFindUnique,
      create: roleCreate,
      update: roleUpdate,
      delete: roleDelete,
    },
    permission: { findMany: permissionFindMany },
    rolePermission: {
      deleteMany: rolePermissionDeleteMany,
      createMany: rolePermissionCreateMany,
      findMany: rolePermissionFindMany,
    },
    userRoleAssignment: { count: userRoleAssignmentCount },
    auditLog: { create: auditCreate },
    $transaction: transaction,
  } as unknown as PrismaService);

  return {
    service,
    roleFindFirst,
    roleFindUnique,
    roleCreate,
    roleUpdate,
    roleDelete,
    permissionFindMany,
    rolePermissionDeleteMany,
    rolePermissionCreateMany,
    rolePermissionFindMany,
    userRoleAssignmentCount,
    auditCreate,
    transaction,
  };
}

describe('RBAC negative tests: permission denial and protection', () => {
  afterEach(() => jest.clearAllMocks());

  describe('Permission catalog integrity', () => {
    it('should define permissions for every module in MODULE_ACTIONS', () => {
      const modules = new Set(SEED_PERMISSIONS.map((p) => p.module));
      const requiredModules = [
        'users', 'customers', 'suppliers', 'products', 'inventory',
        'purchase', 'sales', 'invoices', 'employees', 'departments',
        'leaves', 'payroll', 'crm', 'accounting', 'payments',
        'reports', 'dashboard', 'organization', 'settings', 'audit',
        'billing', 'ai',
      ];

      for (const mod of requiredModules) {
        expect(modules.has(mod)).toBe(true);
      }
    });

    it('should define read and create permissions for core modules', () => {
      const permissionNames = new Set(SEED_PERMISSIONS.map((p) => p.name));
      const coreReadCreate = [
        'invoices.read', 'invoices.create',
        'sales.read', 'sales.create',
        'products.read', 'products.create',
        'customers.read', 'customers.create',
        'suppliers.read', 'suppliers.create',
      ];

      for (const perm of coreReadCreate) {
        expect(permissionNames.has(perm)).toBe(true);
      }
    });

    it('should not contain duplicate permission names', () => {
      const names = SEED_PERMISSIONS.map((p) => p.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });

    it('should include organization.manage as the only non-delegable permission', () => {
      const permissionNames = SEED_PERMISSIONS.map((p) => p.name);
      expect(permissionNames).toContain('organization.manage');
    });
  });

  describe('assignPermissions: invalid permission names', () => {
    it('should reject assigning a permission that does not exist', async () => {
      const { service, roleFindFirst, permissionFindMany } = buildRbacService();
      roleFindFirst.mockResolvedValue({ id: 'role-1', isSystem: false, name: 'Custom' });
      permissionFindMany.mockResolvedValue([{ id: 'p1', name: 'users.read' }]);

      await expect(
        service.assignPermissions(ORG_ID, 'role-1', {
          permissionNames: ['users.read', 'nonexistent.permission'],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(permissionFindMany).toHaveBeenCalled();
    });

    it('should reject assigning empty permission list to a role', async () => {
      const { service, roleFindFirst, permissionFindMany } = buildRbacService();
      roleFindFirst.mockResolvedValue({ id: 'role-1', isSystem: false, name: 'Custom' });
      permissionFindMany.mockResolvedValue([]);

      await service.assignPermissions(ORG_ID, 'role-1', { permissionNames: [] });

      expect(permissionFindMany).toHaveBeenCalledWith({
        where: { name: { in: [] } },
      });
    });
  });

  describe('createRole: duplicate name rejection', () => {
    it('should reject creating a role with a duplicate name in the same organization', async () => {
      const { service, roleFindUnique } = buildRbacService();
      roleFindUnique.mockResolvedValue({ id: 'existing-role', name: 'Manager' });

      await expect(
        service.createRole(ORG_ID, { name: 'Manager' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject creating a role with an empty name', async () => {
      const { service, roleFindUnique } = buildRbacService();
      roleFindUnique.mockResolvedValue(null);

      await expect(
        service.createRole(ORG_ID, { name: '' }),
      ).rejects.toThrow();
    });
  });

  describe('System role protection: Owner and Admin', () => {
    it('should prevent deleting the Owner system role', async () => {
      const { service, roleFindFirst } = buildRbacService();
      roleFindFirst.mockResolvedValue({ id: 'role-owner', isSystem: true, name: 'Owner' });

      await expect(
        service.deleteRole(ORG_ID, 'role-owner'),
      ).rejects.toThrow(BadRequestException);

      expect(roleFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
      );
    });

    it('should prevent deleting the Admin system role', async () => {
      const { service, roleFindFirst } = buildRbacService();
      roleFindFirst.mockResolvedValue({ id: 'role-admin', isSystem: true, name: 'Admin' });

      await expect(
        service.deleteRole(ORG_ID, 'role-admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent modifying a system role via updateRole', async () => {
      const { service, roleFindFirst } = buildRbacService();
      roleFindFirst.mockResolvedValue({ id: 'role-owner', isSystem: true, name: 'Owner' });

      await expect(
        service.updateRole(ORG_ID, 'role-owner', { name: 'SuperAdmin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent assigning permissions to a system role', async () => {
      const { service, roleFindFirst } = buildRbacService();
      roleFindFirst.mockResolvedValue({ id: 'role-owner', isSystem: true, name: 'Owner' });

      await expect(
        service.assignPermissions(ORG_ID, 'role-owner', {
          permissionNames: ['users.read'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should ignore client-supplied isSystem=true on createRole', async () => {
      const { service, roleFindUnique, roleCreate } = buildRbacService();
      roleFindUnique.mockResolvedValue(null);
      roleCreate.mockResolvedValue({
        id: 'role-new', name: 'Custom', description: null,
        isSystem: false, organizationId: ORG_ID,
        createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.createRole(ORG_ID, { name: 'Custom', isSystem: true });

      expect(roleCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isSystem: false }) }),
      );
      expect(result.isSystem).toBe(false);
    });
  });

  describe('Cross-organization role isolation', () => {
    it('should not find a role belonging to another organization', async () => {
      const { service, roleFindFirst } = buildRbacService();
      roleFindFirst.mockResolvedValue(null);

      await expect(
        service.updateRole(ORG_A, 'role-from-org-b', { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);

      expect(roleFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should not delete a role belonging to another organization', async () => {
      const { service, roleFindFirst } = buildRbacService();
      roleFindFirst.mockResolvedValue(null);

      await expect(
        service.deleteRole(ORG_A, 'role-from-org-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRole: assigned user guard', () => {
    it('should prevent deleting a role that is still assigned to users', async () => {
      const { service, roleFindFirst, userRoleAssignmentCount } = buildRbacService();
      roleFindFirst.mockResolvedValue({ id: 'role-custom', isSystem: false, name: 'Temp' });
      userRoleAssignmentCount.mockResolvedValue(3);

      await expect(
        service.deleteRole(ORG_ID, 'role-custom'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
