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
};

function userOfRefresh(payloadId: string) {
  return {
    id: payloadId,
    email: 'a@a.com',
    name: 'A',
    role: 'USER',
    organizationId: 'org1',
    isActive: true,
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