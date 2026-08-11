import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const ORG_ID = 'org-1';
const ACTOR_ID = 'actor-1';
const OWNER_ROLE_ID = 'role-owner';

describe('UsersService', () => {
  let service: UsersService;
  let userFindUnique: jest.Mock;
  let userFindFirst: jest.Mock;
  let txUserCreate: jest.Mock;
  let txUserUpdate: jest.Mock;
  let transaction: jest.Mock;
  let assertCanGrantOwnerRole: jest.Mock;

  beforeEach(() => {
    userFindUnique = jest.fn();
    userFindFirst = jest.fn();
    txUserCreate = jest.fn();
    txUserUpdate = jest.fn();
    transaction = jest.fn();
    assertCanGrantOwnerRole = jest.fn().mockResolvedValue(undefined);

    const mockTx = {
      user: { create: txUserCreate, update: txUserUpdate },
      organizationMember: { upsert: jest.fn().mockResolvedValue({}) },
      role: {
        findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in: string[] } } }) =>
          (args?.where?.id?.in ?? []).map((id) => ({ id })),
        ),
      },
      userRoleAssignment: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
    };
    transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    service = new UsersService(
      {
        user: { findUnique: userFindUnique, findFirst: userFindFirst },
        role: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: transaction,
      } as unknown as PrismaService,
      { assertCanGrantOwnerRole, ensureNotLastOwnerWithRole: jest.fn().mockResolvedValue(undefined) } as unknown as RbacService,
    );

    userFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create (SUPER_ADMIN / role escalation)', () => {
    it('rejects SUPER_ADMIN and does not touch the database', async () => {
      const dto = {
        name: 'A',
        email: 'a@x.com',
        role: UserRole.SUPER_ADMIN,
      } as CreateUserDto;

      await expect(service.create(ORG_ID, ACTOR_ID, dto)).rejects.toThrow(ForbiddenException);

      expect(userFindUnique).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(txUserCreate).not.toHaveBeenCalled();
    });

    it('still allows assigning ADMIN', async () => {
      const dto = { name: 'A', email: 'a@x.com', role: UserRole.ADMIN } as CreateUserDto;
      txUserCreate.mockResolvedValue({
        id: 'u-1',
        email: 'a@x.com',
        name: 'A',
        role: UserRole.ADMIN,
        isActive: true,
      });

      const result = await service.create(ORG_ID, ACTOR_ID, dto);

      expect(result.role).toBe(UserRole.ADMIN);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(txUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: UserRole.ADMIN }) }),
      );
    });

    it.each([UserRole.USER, UserRole.MANAGER, UserRole.VIEWER])(
      'still allows assigning %s',
      async (role) => {
        const dto = { name: 'A', email: 'a@x.com', role } as CreateUserDto;
        txUserCreate.mockResolvedValue({
          id: 'u-1',
          email: 'a@x.com',
          name: 'A',
          role,
          isActive: true,
        });

        const result = await service.create(ORG_ID, ACTOR_ID, dto);

        expect(result.role).toBe(role);
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(txUserCreate).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ role }) }),
        );
      },
    );
  });

  describe('update (SUPER_ADMIN / role escalation)', () => {
    it('rejects SUPER_ADMIN and does not touch the database', async () => {
      const dto = { role: UserRole.SUPER_ADMIN } as UpdateUserDto;

      await expect(service.update(ORG_ID, ACTOR_ID, 'u-1', dto)).rejects.toThrow(ForbiddenException);

      expect(userFindFirst).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(txUserUpdate).not.toHaveBeenCalled();
    });

    it('still allows updating to ADMIN', async () => {
      const dto = { role: UserRole.ADMIN } as UpdateUserDto;
      userFindFirst.mockResolvedValue({ id: 'u-1', organizationId: ORG_ID });
      txUserUpdate.mockResolvedValue({
        id: 'u-1',
        email: 'a@x.com',
        name: 'A',
        role: UserRole.ADMIN,
        isActive: true,
        updatedAt: new Date(),
      });

      const result = await service.update(ORG_ID, ACTOR_ID, 'u-1', dto);

      expect(result.role).toBe(UserRole.ADMIN);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(txUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: UserRole.ADMIN }) }),
      );
    });

    it('rejects SUPER_ADMIN without calling the update write', async () => {
      const dto = { role: UserRole.SUPER_ADMIN } as UpdateUserDto;

      await expect(service.update(ORG_ID, ACTOR_ID, 'u-1', dto)).rejects.toThrow(ForbiddenException);

      expect(txUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe('update (Owner role assignment authorization)', () => {
    const ownerRoleDto = { roleIds: [OWNER_ROLE_ID] } as UpdateUserDto;

    beforeEach(() => {
      userFindFirst.mockResolvedValue({ id: 'target-1', organizationId: ORG_ID });
    });

    it('rejects a non-Owner actor updating another user with the Owner role', async () => {
      assertCanGrantOwnerRole.mockRejectedValue(
        new ForbiddenException('You do not have permission to assign the Owner role'),
      );

      await expect(service.update(ORG_ID, 'admin-1', 'target-1', ownerRoleDto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(assertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, 'admin-1', [OWNER_ROLE_ID]);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('rejects a non-Owner actor updating themselves with the Owner role (self-escalation)', async () => {
      assertCanGrantOwnerRole.mockRejectedValue(new ForbiddenException());

      await expect(service.update(ORG_ID, 'admin-1', 'admin-1', ownerRoleDto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(assertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, 'admin-1', [OWNER_ROLE_ID]);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('still allows a non-Owner actor to assign ADMIN/MANAGER/USER/VIEWER roleIds', async () => {
      const dto = { roleIds: ['role-admin', 'role-user'] } as UpdateUserDto;
      txUserUpdate.mockResolvedValue({
        id: 'target-1',
        email: 'a@x.com',
        name: 'A',
        role: UserRole.USER,
        isActive: true,
        updatedAt: new Date(),
      });

      const result = await service.update(ORG_ID, ACTOR_ID, 'target-1', dto);

      expect(assertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, ACTOR_ID, ['role-admin', 'role-user']);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('target-1');
    });

    it('allows an Owner actor to assign the Owner role', async () => {
      assertCanGrantOwnerRole.mockResolvedValue(undefined);
      txUserUpdate.mockResolvedValue({
        id: 'target-1',
        email: 'a@x.com',
        name: 'A',
        role: UserRole.USER,
        isActive: true,
        updatedAt: new Date(),
      });

      const result = await service.update(ORG_ID, ACTOR_ID, 'target-1', ownerRoleDto);

      expect(assertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, ACTOR_ID, [OWNER_ROLE_ID]);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('target-1');
    });

    it('does not write to the database when Owner assignment is unauthorized', async () => {
      assertCanGrantOwnerRole.mockRejectedValue(new ForbiddenException());

      await expect(service.update(ORG_ID, ACTOR_ID, 'target-1', ownerRoleDto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('create (Owner role authorization)', () => {
    it('rejects a non-Owner actor creating a user with the Owner role', async () => {
      const dto = { name: 'A', email: 'a@x.com', roleIds: [OWNER_ROLE_ID] } as CreateUserDto;
      assertCanGrantOwnerRole.mockRejectedValue(new ForbiddenException());

      await expect(service.create(ORG_ID, 'admin-1', dto)).rejects.toThrow(ForbiddenException);

      expect(assertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, 'admin-1', [OWNER_ROLE_ID]);
      expect(transaction).not.toHaveBeenCalled();
      expect(txUserCreate).not.toHaveBeenCalled();
    });
  });
});

describe('UsersService update (deactivation protection / P3-M1)', () => {
  let service: UsersService;
  let m1findFirst: jest.Mock;
  let m1update: jest.Mock;
  let m1roleFindUnique: jest.Mock;
  let m1assignmentFindUnique: jest.Mock;
  let m1assignmentCount: jest.Mock;
  let m1transaction: jest.Mock;
  let m1AssertCanGrantOwnerRole: jest.Mock;

  const stubOwnerRole = () =>
    m1roleFindUnique.mockImplementation((args: { where: { organizationId_name?: { name: string } } }) =>
      args?.where?.organizationId_name?.name === 'Owner' ? { id: OWNER_ROLE_ID } : null,
    );

  beforeEach(() => {
    m1findFirst = jest.fn();
    m1update = jest.fn();
    m1roleFindUnique = jest.fn();
    m1assignmentFindUnique = jest.fn();
    m1assignmentCount = jest.fn();
    m1transaction = jest.fn();
    m1AssertCanGrantOwnerRole = jest.fn().mockResolvedValue(undefined);

    const mockTx = {
      user: { findFirst: jest.fn(), update: m1update },
      organizationMember: { upsert: jest.fn().mockResolvedValue({}) },
      role: {
        findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in: string[] } } }) =>
          (args?.where?.id?.in ?? []).map((id) => ({ id })),
        ),
      },
      userRoleAssignment: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
    };
    m1transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    service = new UsersService(
      {
        user: { findFirst: m1findFirst, update: m1update },
        role: { findUnique: m1roleFindUnique },
        userRoleAssignment: { findUnique: m1assignmentFindUnique, count: m1assignmentCount },
        $transaction: m1transaction,
      } as unknown as PrismaService,
      { assertCanGrantOwnerRole: m1AssertCanGrantOwnerRole, ensureNotLastOwnerWithRole: jest.fn().mockResolvedValue(undefined) } as unknown as RbacService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects deactivating the last Owner through update() without roleIds', async () => {
    m1findFirst.mockResolvedValue({ id: 'owner-1', organizationId: ORG_ID });
    stubOwnerRole();
    m1assignmentFindUnique.mockResolvedValue({ userId: 'owner-1', roleId: OWNER_ROLE_ID });
    m1assignmentCount.mockResolvedValue(1);

    await expect(
      service.update(ORG_ID, ACTOR_ID, 'owner-1', { isActive: false } as UpdateUserDto),
    ).rejects.toThrow(BadRequestException);

    expect(m1assignmentCount).toHaveBeenCalled();
    expect(m1update).not.toHaveBeenCalled();
    expect(m1transaction).not.toHaveBeenCalled();
  });

  it('allows deactivating a non-last Owner through update()', async () => {
    m1findFirst.mockResolvedValue({ id: 'owner-1', organizationId: ORG_ID });
    stubOwnerRole();
    m1assignmentFindUnique.mockResolvedValue({ userId: 'owner-1', roleId: OWNER_ROLE_ID });
    m1assignmentCount.mockResolvedValue(2);
    m1update.mockResolvedValue({
      id: 'owner-1',
      email: 'a@x.com',
      name: 'A',
      role: 'ADMIN',
      isActive: false,
      updatedAt: new Date(),
    });

    const result = await service.update(ORG_ID, ACTOR_ID, 'owner-1', { isActive: false } as UpdateUserDto);

    expect(result.isActive).toBe(false);
    expect(m1update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
  });

  it('allows deactivating a normal non-Owner user through update()', async () => {
    m1findFirst.mockResolvedValue({ id: 'user-1', organizationId: ORG_ID });
    stubOwnerRole();
    m1assignmentFindUnique.mockResolvedValue(null);
    m1update.mockResolvedValue({
      id: 'user-1',
      email: 'u@x.com',
      name: 'U',
      role: 'USER',
      isActive: false,
      updatedAt: new Date(),
    });

    const result = await service.update(ORG_ID, ACTOR_ID, 'user-1', { isActive: false } as UpdateUserDto);

    expect(result.isActive).toBe(false);
    expect(m1update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
  });

  it('rejects self-deactivation through update()', async () => {
    m1findFirst.mockResolvedValue({ id: ACTOR_ID, organizationId: ORG_ID });

    await expect(
      service.update(ORG_ID, ACTOR_ID, ACTOR_ID, { isActive: false } as UpdateUserDto),
    ).rejects.toThrow(BadRequestException);

    expect(m1update).not.toHaveBeenCalled();
    expect(m1transaction).not.toHaveBeenCalled();
  });

  it('leaves roleIds-based Owner protection and grant behavior intact', async () => {
    m1findFirst.mockResolvedValue({ id: 'target-1', organizationId: ORG_ID });
    stubOwnerRole();
    m1assignmentFindUnique.mockResolvedValue(null);
    m1update.mockResolvedValue({
      id: 'target-1',
      email: 'a@x.com',
      name: 'A',
      role: 'USER',
      isActive: true,
      updatedAt: new Date(),
    });

    const result = await service.update(ORG_ID, ACTOR_ID, 'target-1', {
      roleIds: ['role-user'],
      name: 'Renamed',
    } as UpdateUserDto);

    expect(m1AssertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, ACTOR_ID, ['role-user']);
    expect(result.id).toBe('target-1');
    expect(m1update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Renamed' }) }),
    );
  });
});