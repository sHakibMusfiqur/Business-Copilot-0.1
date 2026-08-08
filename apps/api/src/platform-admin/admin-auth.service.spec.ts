import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AdminAuthService } from './admin-auth.service';
import { AuthService } from '../auth/auth.service';
import { AuthRateLimiterService } from '../auth/auth-rate-limiter.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

type MutablePrisma = {
  user: {
    findUnique: jest.Mock;
  };
};

describe('AdminAuthService (security boundary)', () => {
  let service: AdminAuthService;
  let prisma: MutablePrisma;
  let authService: { generateTokens: jest.Mock };
  let rateLimiter: Record<string, jest.Mock>;
  let auditService: { record: jest.Mock };

  const dto = { email: 'admin@example.com', password: 'password' };

  function baseUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      email: dto.email,
      password: 'hashed',
      role: 'SUPER_ADMIN',
      isActive: true,
      organizationId: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    authService = { generateTokens: jest.fn() };
    rateLimiter = {
      recordAttempt: jest.fn().mockResolvedValue(undefined),
      clearAttempts: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };

    service = new AdminAuthService(
      prisma as unknown as PrismaService,
      authService as unknown as AuthService,
      rateLimiter as unknown as AuthRateLimiterService,
      auditService as unknown as AuditService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an organization user (USER) attempting admin login', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser({ role: 'USER' }));

    await expect(service.login(dto, '1.2.3.4')).rejects.toThrow(UnauthorizedException);
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('rejects any non-SUPER_ADMIN role (ADMIN/MANAGER/VIEWER)', async () => {
    for (const role of ['ADMIN', 'MANAGER', 'VIEWER']) {
      prisma.user.findUnique.mockResolvedValue(baseUser({ role }));

      await expect(service.login(dto, '1.2.3.4')).rejects.toThrow(UnauthorizedException);
    }
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('does not reveal whether an account exists (unknown user -> same error)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login(dto, '1.2.3.4')).rejects.toThrow(UnauthorizedException);
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('does not reveal account existence through the error message', async () => {
    const unknown = service
      .login(dto, '1.2.3.4')
      .catch((e: Error) => e.message);
    prisma.user.findUnique.mockResolvedValue(null);

    const wrongRole = service
      .login(dto, '1.2.3.4')
      .catch((e: Error) => e.message);
    prisma.user.findUnique.mockResolvedValue(baseUser({ role: 'USER' }));

    const messages = await Promise.all([unknown, wrongRole]);
    expect(messages[0]).toBe(messages[1]);
  });

  it('rejects a deactivated account without issuing tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser({ isActive: false }));

    await expect(service.login(dto, '1.2.3.4')).rejects.toThrow(UnauthorizedException);
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('rejects an invalid password without issuing tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(service.login(dto, '1.2.3.4')).rejects.toThrow(UnauthorizedException);
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('issues tokens only after verifying a valid SUPER_ADMIN password', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    authService.generateTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const result = await service.login(dto, '1.2.3.4');

    expect(authService.generateTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', role: 'SUPER_ADMIN' }),
    );
    expect(result).toMatchObject({ user: expect.objectContaining({ role: 'SUPER_ADMIN' }) });
    // The password hash must never be returned to the client.
    expect(JSON.stringify(result)).not.toContain('hashed');
  });
});