import { UnauthorizedException } from '@nestjs/common';

import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';

type MutablePrisma = {
  user: {
    findUnique: jest.Mock;
  };
};

describe('JwtStrategy (auth boundary)', () => {
  let prisma: MutablePrisma;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    strategy = new JwtStrategy(
      prisma as unknown as PrismaService,
      { jwtSecret: 'test-secret' } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('accepts an active, non-deleted user in a live organization', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      organizationId: 'org1',
      deletedAt: null,
      organization: { isActive: true, suspendedAt: null, deletedAt: null },
    });

    const result = await strategy.validate({ id: 'user-1' } as never);

    expect(result).toEqual(
      expect.objectContaining({ id: 'user-1', email: 'a@a.com', role: 'USER' }),
    );
  });

  it('accepts an organization-less user (platform accounts)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
      organizationId: null,
      deletedAt: null,
      organization: null,
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).resolves.toBeDefined();
  });

  it('rejects an unverified user even when active and in a live organization', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: true,
      emailVerified: false,
      organizationId: 'org1',
      deletedAt: null,
      organization: { isActive: true, suspendedAt: null, deletedAt: null },
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a user whose organization is suspended', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      organizationId: 'org1',
      deletedAt: null,
      organization: { isActive: false, suspendedAt: new Date(), deletedAt: null },
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a user whose organization is deleted', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      organizationId: 'org1',
      deletedAt: null,
      organization: { isActive: true, suspendedAt: null, deletedAt: new Date() },
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a user with a set organizationId but a missing organization relation', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      organizationId: 'org1',
      deletedAt: null,
      organization: null,
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a deactivated user regardless of deletedAt', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: false,
      organizationId: 'org1',
      deletedAt: null,
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ deletedAt: true, isActive: true }),
      }),
    );
  });

  it('rejects a soft-deleted user even when isActive is true', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      organizationId: 'org1',
      deletedAt: new Date(),
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});