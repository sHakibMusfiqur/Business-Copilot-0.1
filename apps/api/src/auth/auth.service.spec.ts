import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

type MutablePrisma = {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  refreshToken: {
    findUnique: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    create: jest.Mock;
  };
  onboardingSession: { findFirst: jest.Mock };
  invitation: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

function userOfRefresh(payloadId: string) {
  return {
    id: payloadId,
    email: 'a@a.com',
    name: 'A',
    role: 'USER',
    organizationId: 'org1',
    isActive: true,
    deletedAt: null,
    organization: { isActive: true, suspendedAt: null, deletedAt: null },
  };
}

describe('AuthService (refresh / logout / reset security)', () => {
  let service: AuthService;
  let prisma: MutablePrisma;
  let jwtService: { verify: jest.Mock; sign: jest.Mock; signAsync: jest.Mock };
  let config: { jwtSecret: string; jwtRefreshSecret: string; jwtRefreshExpiresIn: string; webUrl: string };
  let rateLimiter: Record<string, jest.Mock>;
  let audit: { record: jest.Mock };
  let mail: { sendOrgEmail: jest.Mock };

  const uId = 'user-1';
  const oldRefreshToken = 'refresh-v1';

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      onboardingSession: { findFirst: jest.fn() },
      invitation: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    jwtService = {
      verify: jest.fn(),
      sign: jest.fn(),
      signAsync: jest.fn(),
    };
    config = {
      jwtSecret: 'secret',
      jwtRefreshSecret: 'refresh-secret',
      jwtRefreshExpiresIn: '7d',
      webUrl: 'http://localhost:3000',
    };
    rateLimiter = {
      recordAttempt: jest.fn().mockResolvedValue(undefined),
      clearAttempts: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    mail = { sendOrgEmail: jest.fn() };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      rateLimiter as unknown as AuthRateLimiterService,
      audit as unknown as AuditService,
      mail as unknown as MailService,
    );

    // getOnboardingCompleted default: no session -> fall back to orgId.
    prisma.onboardingSession.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshToken', () => {
    it('rejects a refresh token that is not in the store (reuse / tampered)', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(oldRefreshToken, '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a cryptographically invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.refreshToken('bad-token', '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects an expired stored token after deleting it', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refreshToken(oldRefreshToken, '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a refresh for an unknown or deactivated account', async () => {
      jwtService.verify.mockReturnValue({ id: 'ghost' });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: 'ghost',
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(oldRefreshToken, '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a refresh for a soft-deleted user even when isActive is true', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue({
        ...userOfRefresh(uId),
        isActive: true,
        deletedAt: new Date(),
      });

      await expect(service.refreshToken(oldRefreshToken, '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REFRESH_TOKEN',
          status: 'FAILURE',
          userId: uId,
          metadata: expect.objectContaining({ reason: 'User soft-deleted' }),
        }),
      );
    });

    it('rejects a refresh for a user whose organization is suspended', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue({
        ...userOfRefresh(uId),
        deletedAt: null,
        organization: { isActive: false, suspendedAt: new Date(), deletedAt: null },
      });

      await expect(service.refreshToken(oldRefreshToken, '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a refresh for a user whose organization is deleted', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue({
        ...userOfRefresh(uId),
        deletedAt: null,
        organization: { isActive: true, suspendedAt: null, deletedAt: new Date() },
      });

      await expect(service.refreshToken(oldRefreshToken, '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a refresh when the organization relation is missing while organizationId is set', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue({
        ...userOfRefresh(uId),
        organization: null,
      });

      await expect(service.refreshToken(oldRefreshToken, '1.1.1.1')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('keeps a valid refresh for an organization-less user (platform account)', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue({
        ...userOfRefresh(uId),
        organizationId: null,
        organization: null,
      });
      jwtService.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');

      const result = await service.refreshToken(oldRefreshToken, '1.1.1.1');

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
      );
    });

    it('rotates the refresh token (old deleted, new stored) on success', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue(userOfRefresh(uId));
      jwtService.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');

      const result = await service.refreshToken(oldRefreshToken, '1.1.1.1');

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
      );
    });
  });

  describe('login', () => {
    it('rejects a user whose organization is suspended without issuing tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        name: 'A',
        role: 'USER',
        password: 'hash',
        isActive: true,
        organizationId: 'org1',
        deletedAt: null,
        organization: { isActive: false, suspendedAt: new Date(), deletedAt: null },
      });

      await expect(
        service.login({ email: 'a@a.com', password: 'whatever' } as never, '1.1.1.1'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(rateLimiter.recordAttempt).toHaveBeenCalled();
    });

    it('rejects a user whose organization is deleted without issuing tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        name: 'A',
        role: 'USER',
        password: 'hash',
        isActive: true,
        organizationId: 'org1',
        deletedAt: null,
        organization: { isActive: true, suspendedAt: null, deletedAt: new Date() },
      });

      await expect(
        service.login({ email: 'a@a.com', password: 'whatever' } as never, '1.1.1.1'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a user whose organization relation is missing while organizationId is set', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        name: 'A',
        role: 'USER',
        password: 'hash',
        isActive: true,
        organizationId: 'org1',
        deletedAt: null,
        organization: null,
      });

      await expect(
        service.login({ email: 'a@a.com', password: 'whatever' } as never, '1.1.1.1'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(rateLimiter.recordAttempt).toHaveBeenCalled();
    });

    it('accepts an organization-less user (platform account) with no org check', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        name: 'A',
        role: 'SUPER_ADMIN',
        password: 'hash',
        isActive: true,
        organizationId: null,
        deletedAt: null,
        organization: null,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'a@a.com', password: 'correct' } as never,
        '1.1.1.1',
      );

      expect(result).toEqual(expect.objectContaining({ accessToken: 'access' }));
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('accepts an active user in a live organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        name: 'A',
        role: 'USER',
        password: 'hash',
        isActive: true,
        organizationId: 'org1',
        deletedAt: null,
        organization: { isActive: true, suspendedAt: null, deletedAt: null },
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'a@a.com', password: 'correct' } as never,
        '1.1.1.1',
      );

      expect(result).toEqual(expect.objectContaining({ accessToken: 'access' }));
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('registers a user without creating an organization (organizationId stays null)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitation.findFirst.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');

      const createdUser = {
        id: 'user-new',
        email: 'new@a.com',
        name: 'New',
        role: 'USER',
        organizationId: null,
        createdAt: new Date('2024-01-01'),
      };
      const txUserCreate = jest.fn().mockResolvedValue(createdUser);
      const tx = {
        user: { create: txUserCreate, update: jest.fn() },
        organization: { create: jest.fn(), findUnique: jest.fn() },
        organizationMember: { create: jest.fn() },
        userRoleAssignment: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
      jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(
        { email: 'new@a.com', name: 'New', password: 'pw' } as never,
        '1.1.1.1',
      );

      // The provisioning guard requires the owner's organizationId to be null
      // (or the session's org) before assigning a real one; a placeholder org
      // assigned here would break register -> provision with a ConflictException.
      expect(result.user.organizationId).toBeNull();
      expect(txUserCreate).toHaveBeenCalledTimes(1);
      expect(tx.organization.create).not.toHaveBeenCalled();
      expect(tx.organization.findUnique).not.toHaveBeenCalled();
      expect(tx.organizationMember.create).not.toHaveBeenCalled();
      expect(tx.userRoleAssignment.create).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('logout', () => {
    it('invalidates every stored refresh token for the caller only', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: uId, organizationId: 'org1' });

      await service.logout(uId, '1.1.1.1');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: uId } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT', userId: uId, status: 'SUCCESS' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid/expired reset token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('expired');
      });

      await expect(service.resetPassword('bad', 'NewPass1!')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('invalidates all sessions after a valid reset', async () => {
      jwtService.verify.mockReturnValue({ sub: uId, purpose: 'password-reset', iat: Math.floor(Date.now() / 1000) });
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        organizationId: 'org1',
        deletedAt: null,
        isActive: true,
        updatedAt: new Date(Date.now() - 10000),
      });
      (argon2.hash as jest.Mock).mockResolvedValue('new-hash');

      await service.resetPassword('valid-token', 'NewPass1!');

      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: uId } });
    });

    it('rejects a password-reset token that has already been used', async () => {
      const tokenIat = Math.floor(Date.now() / 1000);
      jwtService.verify.mockReturnValue({ sub: uId, purpose: 'password-reset', iat: tokenIat });

      // First call: user's updatedAt is BEFORE the token's iat → allowed
      prisma.user.findUnique.mockResolvedValueOnce({
        id: uId,
        email: 'a@a.com',
        organizationId: 'org1',
        deletedAt: null,
        isActive: true,
        updatedAt: new Date((tokenIat - 60) * 1000),
      });
      (argon2.hash as jest.Mock).mockResolvedValue('new-hash');

      await service.resetPassword('valid-token', 'NewPass1!');

      // Second call with the same token: user's updatedAt was advanced by
      // the first reset (via @updatedAt), so now iat < updatedAt → rejected
      prisma.user.findUnique.mockResolvedValueOnce({
        id: uId,
        email: 'a@a.com',
        organizationId: 'org1',
        deletedAt: null,
        isActive: true,
        updatedAt: new Date((tokenIat + 60) * 1000),
      });

      await expect(service.resetPassword('valid-token', 'NewPass2!')).rejects.toThrow(BadRequestException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a reset token older than the user updatedAt', async () => {
      const tokenIat = Math.floor(Date.now() / 1000);
      jwtService.verify.mockReturnValue({ sub: uId, purpose: 'password-reset', iat: tokenIat });

      // User's updatedAt is AFTER the token's iat → stale token
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        organizationId: 'org1',
        deletedAt: null,
        isActive: true,
        updatedAt: new Date((tokenIat + 300) * 1000),
      });

      await expect(service.resetPassword('old-token', 'NewPass1!')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });
});