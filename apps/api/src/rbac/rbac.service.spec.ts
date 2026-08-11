import { BadRequestException, NotFoundException } from '@nestjs/common';

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

describe('RbacService deletedAt guard on user-role assignment (P3-L3)', () => {
  let service: RbacService;
  let userFindFirst: jest.Mock;
  let roleFindMany: jest.Mock;
  let roleFindUnique: jest.Mock;
  let roleFindFirst: jest.Mock;
  let userRoleAssignmentDeleteMany: jest.Mock;
  let userRoleAssignmentCreateMany: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    userFindFirst = jest.fn();
    roleFindMany = jest.fn();
    roleFindUnique = jest.fn();
    roleFindFirst = jest.fn();
    userRoleAssignmentDeleteMany = jest.fn().mockResolvedValue({});
    userRoleAssignmentCreateMany = jest.fn().mockResolvedValue({});

    transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        userRoleAssignment: { deleteMany: userRoleAssignmentDeleteMany, createMany: userRoleAssignmentCreateMany },
      }),
    );

    service = new RbacService({
      user: { findFirst: userFindFirst },
      role: {
        findFirst: roleFindFirst,
        findUnique: roleFindUnique,
        findMany: roleFindMany,
        create: jest.fn(),
        update: jest.fn(),
      },
      userRoleAssignment: { deleteMany: userRoleAssignmentDeleteMany, createMany: userRoleAssignmentCreateMany },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignUserRoles', () => {
    it('rejects role assignment to a soft-deleted user', async () => {
      userFindFirst.mockResolvedValue(null);

      await expect(
        service.assignUserRoles('org-1', 'deleted-user', { roleIds: ['role-1'] }),
      ).rejects.toThrow(NotFoundException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('enforces deletedAt: null when looking up the target user', async () => {
      userFindFirst.mockResolvedValue(null);

      await expect(
        service.assignUserRoles('org-1', 'deleted-user', { roleIds: ['role-1'] }),
      ).rejects.toThrow(NotFoundException);

      expect(userFindFirst).toHaveBeenCalledWith({
        where: { id: 'deleted-user', organizationId: 'org-1', deletedAt: null },
      });
    });

    it('allows role assignment to an active (non-deleted) user', async () => {
      userFindFirst.mockResolvedValue({ id: 'active-user' });
      roleFindMany.mockResolvedValue([{ id: 'role-1' }]);

      await service.assignUserRoles('org-1', 'active-user', { roleIds: ['role-1'] });

      expect(userRoleAssignmentDeleteMany).toHaveBeenCalledWith({ where: { userId: 'active-user' } });
      expect(userRoleAssignmentCreateMany).toHaveBeenCalledWith({
        data: [{ userId: 'active-user', roleId: 'role-1' }],
      });
    });
  });

  describe('getUserRoles', () => {
    it('rejects role retrieval for a soft-deleted user', async () => {
      userFindFirst.mockResolvedValue(null);

      await expect(
        service.getUserRoles('org-1', 'deleted-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces deletedAt: null when looking up the target user', async () => {
      userFindFirst.mockResolvedValue(null);

      await expect(
        service.getUserRoles('org-1', 'deleted-user'),
      ).rejects.toThrow(NotFoundException);

      expect(userFindFirst).toHaveBeenCalledWith({
        where: { id: 'deleted-user', organizationId: 'org-1', deletedAt: null },
      });
    });

    it('returns roles for an active (non-deleted) user', async () => {
      userFindFirst.mockResolvedValue({ id: 'active-user' });
      roleFindMany.mockResolvedValue([{ id: 'role-1', name: 'Admin' }]);

      const result = await service.getUserRoles('org-1', 'active-user');

      expect(result).toEqual([{ id: 'role-1', name: 'Admin' }]);
    });
  });
});

describe('RbacService assignUserRoles Owner protection (D-4)', () => {
  let service: RbacService;
  let userFindFirst: jest.Mock;
  let roleFindMany: jest.Mock;
  let roleFindUnique: jest.Mock;
  let assignmentFindUnique: jest.Mock;
  let assignmentCount: jest.Mock;
  let assignmentDeleteMany: jest.Mock;
  let assignmentCreateMany: jest.Mock;
  let transaction: jest.Mock;

  const OWNER_ROLE_ID = 'role-owner';

  beforeEach(() => {
    userFindFirst = jest.fn();
    roleFindMany = jest.fn();
    roleFindUnique = jest.fn();
    assignmentFindUnique = jest.fn();
    assignmentCount = jest.fn();
    assignmentDeleteMany = jest.fn().mockResolvedValue({});
    assignmentCreateMany = jest.fn().mockResolvedValue({});

    transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        userRoleAssignment: { deleteMany: assignmentDeleteMany, createMany: assignmentCreateMany },
      }),
    );

    const stubOwnerRole = () =>
      roleFindUnique.mockImplementation(
        (args: { where: { organizationId_name?: { name: string } } }) =>
          args?.where?.organizationId_name?.name === 'Owner' ? { id: OWNER_ROLE_ID } : null,
      );

    service = new RbacService({
      user: { findFirst: userFindFirst },
      role: {
        findFirst: jest.fn(),
        findUnique: roleFindUnique,
        findMany: roleFindMany,
        create: jest.fn(),
        update: jest.fn(),
      },
      userRoleAssignment: {
        findUnique: assignmentFindUnique,
        count: assignmentCount,
        deleteMany: assignmentDeleteMany,
        createMany: assignmentCreateMany,
      },
      $transaction: transaction,
    } as unknown as PrismaService);

    stubOwnerRole();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows demoting one Owner when another Owner remains', async () => {
    userFindFirst.mockResolvedValue({ id: 'owner-1' });
    roleFindMany.mockResolvedValue([{ id: 'role-admin' }]);
    assignmentFindUnique.mockResolvedValue({ userId: 'owner-1', roleId: OWNER_ROLE_ID });
    assignmentCount.mockResolvedValue(2);

    await service.assignUserRoles('org-1', 'owner-1', { roleIds: ['role-admin'] });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(assignmentDeleteMany).toHaveBeenCalledWith({ where: { userId: 'owner-1' } });
    expect(assignmentCreateMany).toHaveBeenCalledWith({
      data: [{ userId: 'owner-1', roleId: 'role-admin' }],
    });
  });

  it('rejects removing the Owner role from the last Owner', async () => {
    userFindFirst.mockResolvedValue({ id: 'owner-1' });
    roleFindMany.mockResolvedValue([{ id: 'role-admin' }]);
    assignmentFindUnique.mockResolvedValue({ userId: 'owner-1', roleId: OWNER_ROLE_ID });
    assignmentCount.mockResolvedValue(1);

    await expect(
      service.assignUserRoles('org-1', 'owner-1', { roleIds: ['role-admin'] }),
    ).rejects.toThrow(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
    expect(assignmentDeleteMany).not.toHaveBeenCalled();
  });

  it('allows assigning a non-Owner role to a non-Owner user', async () => {
    userFindFirst.mockResolvedValue({ id: 'user-1' });
    roleFindMany.mockResolvedValue([{ id: 'role-user' }]);
    assignmentFindUnique.mockResolvedValue(null);

    await service.assignUserRoles('org-1', 'user-1', { roleIds: ['role-user'] });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(assignmentCreateMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-user' }],
    });
  });

  it('allows reassignment that retains the Owner role', async () => {
    userFindFirst.mockResolvedValue({ id: 'owner-1' });
    roleFindMany.mockResolvedValue([
      { id: OWNER_ROLE_ID },
      { id: 'role-admin' },
    ]);
    assignmentFindUnique.mockResolvedValue({ userId: 'owner-1', roleId: OWNER_ROLE_ID });

    await service.assignUserRoles('org-1', 'owner-1', {
      roleIds: [OWNER_ROLE_ID, 'role-admin'],
    });

    expect(assignmentCount).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});