import { BadRequestException } from '@nestjs/common';

import { RbacService } from './rbac.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RbacService', () => {
  let service: RbacService;
  let roleFindFirst: jest.Mock;
  let roleFindUnique: jest.Mock;
  let permissionFindMany: jest.Mock;
  let roleCreate: jest.Mock;
  let roleUpdate: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    roleFindFirst = jest.fn();
    roleFindUnique = jest.fn();
    permissionFindMany = jest.fn();
    roleCreate = jest.fn();
    roleUpdate = jest.fn();
    transaction = jest.fn();
    transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      }),
    );

    service = new RbacService({
      role: { findFirst: roleFindFirst, findUnique: roleFindUnique, create: roleCreate, update: roleUpdate },
      permission: { findMany: permissionFindMany },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignPermissions (system role protection)', () => {
    it('rejects modifying a system role and performs no permission mutation', async () => {
      roleFindFirst.mockResolvedValue({ id: 'role-1', isSystem: true, name: 'Admin' });

      await expect(
        service.assignPermissions('org-1', 'role-1', { permissionNames: ['users.read'] }),
      ).rejects.toThrow(BadRequestException);

      expect(permissionFindMany).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('still allows assigning permissions to a custom role', async () => {
      roleFindFirst.mockResolvedValue({ id: 'role-2', isSystem: false, name: 'Custom' });
      permissionFindMany.mockResolvedValue([{ id: 'perm-1', name: 'users.read' }]);

      await service.assignPermissions('org-1', 'role-2', { permissionNames: ['users.read'] });

      expect(transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('assignPermissions DTO', () => {
    // Ensures the service still resolves permission ids via findMany on the
    // custom-role path so a rejected path has no side effect.
    it('does not resolve permissions for a system role', async () => {
      roleFindFirst.mockResolvedValue({ id: 'role-system', isSystem: true, name: 'Owner' });

      await expect(
        service.assignPermissions('org-1', 'role-system', { permissionNames: ['organization.manage'] }),
      ).rejects.toThrow(BadRequestException);

      expect(permissionFindMany).not.toHaveBeenCalled();
    });
  });

  describe('createRole (isSystem server-controlled)', () => {
    it('ignores a client-supplied isSystem=true and creates a non-system role', async () => {
      roleFindUnique.mockResolvedValue(null);
      roleCreate.mockResolvedValue({
        id: 'role-new',
        name: 'Custom',
        description: null,
        isSystem: false,
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createRole('org-1', { name: 'Custom', isSystem: true });

      expect(roleCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isSystem: false }) }),
      );
      expect(result.isSystem).toBe(false);
    });

    it('still creates a normal custom role', async () => {
      roleFindUnique.mockResolvedValue(null);
      roleCreate.mockResolvedValue({
        id: 'role-new',
        name: 'Manager',
        description: null,
        isSystem: false,
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createRole('org-1', { name: 'Manager' });

      expect(roleCreate).toHaveBeenCalled();
      expect(result.name).toBe('Manager');
    });
  });

  describe('updateRole (isSystem server-controlled)', () => {
    it('does not let a client flip isSystem on a custom role', async () => {
      roleFindFirst.mockResolvedValue({ id: 'role-x', isSystem: false, name: 'Custom' });
      roleFindUnique.mockResolvedValue(null);
      roleUpdate.mockResolvedValue({ id: 'role-x', name: 'Custom', isSystem: false });

      await service.updateRole('org-1', 'role-x', { isSystem: true });

      expect(roleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ isSystem: true }) }),
      );
    });
  });

  describe('assertCanGrantOwnerRole', () => {
    let getUserPermissions: jest.Mock;

    beforeEach(() => {
      // override the permission resolution path
      getUserPermissions = jest.fn();
      (service.getUserPermissions as unknown) = getUserPermissions;
    });

    it('returns early when no roleIds are provided', async () => {
      await expect(service.assertCanGrantOwnerRole('org-1', 'actor', undefined)).resolves.toBeUndefined();
      expect(roleFindUnique).not.toHaveBeenCalled();
    });

    it('allows assignment when the role is not the Owner role', async () => {
      roleFindUnique.mockResolvedValue({ id: 'role-owner' });

      await expect(service.assertCanGrantOwnerRole('org-1', 'actor', ['role-admin'])).resolves.toBeUndefined();
      expect(getUserPermissions).not.toHaveBeenCalled();
    });
  });
});