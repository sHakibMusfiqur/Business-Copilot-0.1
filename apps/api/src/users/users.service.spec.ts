import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const ORG_ID = 'org-1';
const ACTOR_ID = 'actor-1';

describe('UsersService SUPER_ADMIN role escalation', () => {
  let service: UsersService;
  let userFindUnique: jest.Mock;
  let userFindFirst: jest.Mock;
  let txUserCreate: jest.Mock;
  let txUserUpdate: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    userFindUnique = jest.fn();
    userFindFirst = jest.fn();
    txUserCreate = jest.fn();
    txUserUpdate = jest.fn();
    transaction = jest.fn();

    const mockTx = {
      user: { create: txUserCreate, update: txUserUpdate },
      organizationMember: { upsert: jest.fn().mockResolvedValue({}) },
      role: { findMany: jest.fn() },
      userRoleAssignment: { createMany: jest.fn() },
    };
    transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    service = new UsersService({
      user: { findUnique: userFindUnique, findFirst: userFindFirst },
      $transaction: transaction,
    } as unknown as PrismaService);

    userFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
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

  describe('update', () => {
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
});