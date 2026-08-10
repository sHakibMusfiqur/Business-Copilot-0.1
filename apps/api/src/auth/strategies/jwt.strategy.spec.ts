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

  it('accepts an active, non-deleted user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@a.com',
      role: 'USER',
      isActive: true,
      organizationId: 'org1',
      deletedAt: null,
    });

    const result = await strategy.validate({ id: 'user-1' } as never);

    expect(result).toEqual(
      expect.objectContaining({ id: 'user-1', email: 'a@a.com', role: 'USER' }),
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
      organizationId: 'org1',
      deletedAt: new Date(),
    });

    await expect(strategy.validate({ id: 'user-1' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});