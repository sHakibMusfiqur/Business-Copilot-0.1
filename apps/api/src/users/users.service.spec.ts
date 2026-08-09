import { ForbiddenException } from '@nestjs/common';
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
      { assertCanGrantOwnerRole } as unknown as RbacService,
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