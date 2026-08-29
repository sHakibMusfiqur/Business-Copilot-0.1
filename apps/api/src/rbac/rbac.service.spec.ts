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

describe('RbacService getRoleUsers (role roster)', () => {
  let service: RbacService;
  let roleFindFirst: jest.Mock;
  let userFindMany: jest.Mock;

  beforeEach(() => {
    roleFindFirst = jest.fn();
    userFindMany = jest.fn();
    service = new RbacService({
      role: { findFirst: roleFindFirst },
      user: { findMany: userFindMany },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the users assigned to a role within the organization', async () => {
    roleFindFirst.mockResolvedValue({ id: 'role-1', name: 'Inventory Viewer' });
    userFindMany.mockResolvedValue([
      {
        id: 'u1',
        name: 'John',
        email: 'john@example.com',
        avatar: null,
        isActive: true,
        roleAssignments: [{ role: { id: 'role-1', name: 'Inventory Viewer', isSystem: false } }],
      },
    ]);

    const result = await service.getRoleUsers('org-1', 'role-1');

    expect(roleFindFirst).toHaveBeenCalledWith({
      where: { id: 'role-1', organizationId: 'org-1' },
    });
    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        deletedAt: null,
        roleAssignments: { some: { roleId: 'role-1' } },
      },
      select: expect.any(Object),
      orderBy: { name: 'asc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'u1', name: 'John', isActive: true });
  });

  it('returns an empty roster when no users are assigned to the role', async () => {
    roleFindFirst.mockResolvedValue({ id: 'role-1' });
    userFindMany.mockResolvedValue([]);

    await expect(service.getRoleUsers('org-1', 'role-1')).resolves.toEqual([]);
  });

  it('rejects a role that belongs to another organization (tenant isolation)', async () => {
    roleFindFirst.mockResolvedValue(null);

    await expect(service.getRoleUsers('org-1', 'role-from-org-2')).rejects.toThrow(NotFoundException);
    expect(userFindMany).not.toHaveBeenCalled();
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

describe('RbacService getUserEffectivePermissions', () => {
  let service: RbacService;
  let userFindFirst: jest.Mock;
  let userRoleAssignmentFindMany: jest.Mock;

  beforeEach(() => {
    userFindFirst = jest.fn();
    userRoleAssignmentFindMany = jest.fn();
    service = new RbacService({
      user: { findFirst: userFindFirst },
      userRoleAssignment: { findMany: userRoleAssignmentFindMany },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns user identity, roles, and deduplicated permissions with source roles', async () => {
    userFindFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      avatar: null,
    });
    userRoleAssignmentFindMany.mockResolvedValue([
      {
        role: {
          id: 'role-finance',
          name: 'Finance Manager',
          isSystem: false,
          rolePermissions: [
            { permission: { id: 'p1', name: 'accounting.read', module: 'accounting', label: 'Read Accounting' } },
            { permission: { id: 'p2', name: 'accounting.create', module: 'accounting', label: 'Create Accounting' } },
          ],
        },
      },
      {
        role: {
          id: 'role-admin',
          name: 'Admin',
          isSystem: true,
          rolePermissions: [
            { permission: { id: 'p1', name: 'accounting.read', module: 'accounting', label: 'Read Accounting' } },
            { permission: { id: 'p3', name: 'users.read', module: 'users', label: 'Read Users' } },
          ],
        },
      },
    ]);

    const result = await service.getUserEffectivePermissions('org-1', 'user-1');

    expect(result.user).toEqual({
      id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      avatar: null,
    });
    expect(result.roles).toEqual([
      { id: 'role-finance', name: 'Finance Manager', isSystem: false },
      { id: 'role-admin', name: 'Admin', isSystem: true },
    ]);
    expect(result.permissions).toHaveLength(3);
    // accounting.read appears in both roles
    const acctRead = result.permissions.find((p) => p.name === 'accounting.read');
    expect(acctRead?.sourceRoles).toHaveLength(2);
    expect(acctRead?.sourceRoles.map((r) => r.id)).toEqual(['role-finance', 'role-admin']);
    // accounting.create only in Finance Manager
    const acctCreate = result.permissions.find((p) => p.name === 'accounting.create');
    expect(acctCreate?.sourceRoles).toHaveLength(1);
    expect(acctCreate?.sourceRoles[0].id).toBe('role-finance');
  });

  it('returns empty permissions for a user with no roles', async () => {
    userFindFirst.mockResolvedValue({
      id: 'user-2',
      name: 'Bob',
      email: 'bob@example.com',
      avatar: null,
    });
    userRoleAssignmentFindMany.mockResolvedValue([]);

    const result = await service.getUserEffectivePermissions('org-1', 'user-2');

    expect(result.user.id).toBe('user-2');
    expect(result.roles).toEqual([]);
    expect(result.permissions).toEqual([]);
  });

  it('rejects a user that does not exist in the organization (tenant isolation)', async () => {
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.getUserEffectivePermissions('org-1', 'user-from-org-2'),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleAssignmentFindMany).not.toHaveBeenCalled();
  });

  it('includes system role permissions in the effective set', async () => {
    userFindFirst.mockResolvedValue({
      id: 'user-3',
      name: 'Carol',
      email: 'carol@example.com',
      avatar: null,
    });
    userRoleAssignmentFindMany.mockResolvedValue([
      {
        role: {
          id: 'role-owner',
          name: 'Owner',
          isSystem: true,
          rolePermissions: [
            { permission: { id: 'p1', name: 'organization.manage', module: 'organization', label: 'Manage Organization' } },
          ],
        },
      },
    ]);

    const result = await service.getUserEffectivePermissions('org-1', 'user-3');

    expect(result.permissions).toHaveLength(1);
    expect(result.permissions[0].name).toBe('organization.manage');
    expect(result.permissions[0].sourceRoles[0].name).toBe('Owner');
  });
});