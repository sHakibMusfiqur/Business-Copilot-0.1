import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';

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
  onboardingSession: { findFirst: jest.Mock; updateMany: jest.Mock };
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
    emailVerified: true,
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
  let redis: { get: jest.Mock; set: jest.Mock; delete: jest.Mock };

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
      onboardingSession: { findFirst: jest.fn(), updateMany: jest.fn() },
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
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      rateLimiter as unknown as AuthRateLimiterService,
      audit as unknown as AuditService,
      mail as unknown as MailService,
      redis as unknown as RedisService,
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

    it('rejects a refresh for an unverified user', async () => {
      jwtService.verify.mockReturnValue({ id: uId });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: oldRefreshToken,
        userId: uId,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUnique.mockResolvedValue({ ...userOfRefresh(uId), emailVerified: false });

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
    it('rejects an unverified user without issuing tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        name: 'A',
        role: 'USER',
        password: 'hash',
        isActive: true,
        emailVerified: false,
        organizationId: 'org1',
        deletedAt: null,
        organization: { isActive: true, suspendedAt: null, deletedAt: null },
      });

      await expect(
        service.login({ email: 'a@a.com', password: 'whatever' } as never, '1.1.1.1'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a user whose organization is suspended without issuing tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: uId,
        email: 'a@a.com',
        name: 'A',
        role: 'USER',
        password: 'hash',
        isActive: true,
        emailVerified: true,
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
        emailVerified: true,
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
        emailVerified: true,
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
        emailVerified: true,
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
        emailVerified: true,
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
    const createdUser = {
      id: 'user-new',
      email: 'new@a.com',
      name: 'New',
      role: 'USER',
      organizationId: null,
      createdAt: new Date('2024-01-01'),
    };
    const tx = {
      user: { create: jest.fn(), update: jest.fn() },
      organization: { create: jest.fn(), findUnique: jest.fn() },
      organizationMember: { create: jest.fn() },
      userRoleAssignment: { create: jest.fn() },
    };
    let txUserCreate: jest.Mock;

    beforeEach(() => {
      prisma.user.findUnique.mockReset();
      prisma.invitation.findFirst.mockReset();
      (argon2.hash as jest.Mock).mockReset();
      jwtService.sign.mockReset();
      prisma.refreshToken.create.mockClear();
      prisma.user.update.mockClear();
      mail.sendOrgEmail.mockReset();
      txUserCreate = tx.user.create;
      (tx.user.create as jest.Mock).mockReset();
      txUserCreate.mockResolvedValue(createdUser);
      prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
    });

    it('creates an unverified user with no organization and issues no session tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.invitation.findFirst.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      jwtService.sign.mockReturnValue('verify-token');
      mail.sendOrgEmail.mockResolvedValue({ sent: true });

      const result = await service.register(
        { email: 'new@a.com', name: 'New', password: 'pw' } as never,
        '1.1.1.1',
      );

      expect(txUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@a.com', emailVerified: false }),
        }),
      );
      // No organization is ever assigned at registration; the created user's
      // organizationId stays null (schema default).
      expect(txUserCreate.mock.calls[0][0].data).not.toHaveProperty('organizationId');
      expect(result.user).toMatchObject({ id: 'user-new', email: 'new@a.com' });
      expect(tx.organization.create).not.toHaveBeenCalled();
      expect(tx.organization.findUnique).not.toHaveBeenCalled();
      expect(tx.organizationMember.create).not.toHaveBeenCalled();
      expect(tx.userRoleAssignment.create).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      // A verification email is sent instead of an authenticated session.
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-new', purpose: 'verify-email' }),
        expect.any(Object),
      );
      expect(mail.sendOrgEmail).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ type: 'emailVerification' }),
      );
      expect(result).toEqual(expect.objectContaining({ message: expect.any(String) }));
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('resends a verification link for an existing unverified account instead of creating a second user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-exists',
        email: 'new@a.com',
        isActive: true,
        emailVerified: false,
      });
      jwtService.sign.mockReturnValue('verify-token');
      mail.sendOrgEmail.mockResolvedValue({ sent: true });

      const result = await service.register(
        { email: 'new@a.com', name: 'New', password: 'pw2' } as never,
        '1.1.1.1',
      );

      expect(txUserCreate).not.toHaveBeenCalled();
      expect(mail.sendOrgEmail).toHaveBeenCalledTimes(1);
      // The password must never be overwritten on a resend path.
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.user.id).toBe('user-exists');
      expect(result.user.email).toBe('new@a.com');
    });

    it('rejects a verified duplicate email with 409 and does not resend', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-exists',
        email: 'new@a.com',
        isActive: true,
        emailVerified: true,
      });

      await expect(
        service.register({ email: 'new@a.com', name: 'New', password: 'pw' } as never, '1.1.1.1'),
      ).rejects.toThrow(ConflictException);
      expect(txUserCreate).not.toHaveBeenCalled();
      expect(mail.sendOrgEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    beforeEach(() => {
      jwtService.verify.mockReset();
      prisma.user.findUnique.mockReset();
      prisma.user.update.mockClear();
    });

    it('marks the matching user verified (bound by purpose, user and email)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-new', purpose: 'verify-email', email: 'a@a.com' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-new',
        email: 'a@a.com',
        isActive: true,
        emailVerified: false,
        deletedAt: null,
        organizationId: null,
      });

      const result = await service.verifyEmail('token', '1.1.1.1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-new' },
        data: { emailVerified: true },
      });
      expect(result.message).toContain('verified');
    });

    it('rejects an invalid or expired token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('expired');
      });

      await expect(service.verifyEmail('bad', '1.1.1.1')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token whose purpose is not verify-email', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-new', purpose: 'password-reset', email: 'a@a.com' });

      await expect(service.verifyEmail('token', '1.1.1.1')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token issued for a different email (no cross-account verification)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-new', purpose: 'verify-email', email: 'other@a.com' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-new',
        email: 'a@a.com',
        isActive: true,
        emailVerified: false,
        deletedAt: null,
        organizationId: null,
      });

      await expect(service.verifyEmail('token', '1.1.1.1')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token for a deactivated account', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-new', purpose: 'verify-email', email: 'a@a.com' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-new',
        email: 'a@a.com',
        isActive: false,
        emailVerified: false,
        deletedAt: null,
        organizationId: null,
      });

      await expect(service.verifyEmail('token', '1.1.1.1')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('is idempotent for an already-verified user (does not re-update)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-new', purpose: 'verify-email', email: 'a@a.com' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-new',
        email: 'a@a.com',
        isActive: true,
        emailVerified: true,
        deletedAt: null,
        organizationId: null,
      });

      const result = await service.verifyEmail('token', '1.1.1.1');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.message).toContain('already verified');
    });
  });

  describe('resendVerificationEmail', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockReset();
      jwtService.sign.mockReset();
      mail.sendOrgEmail.mockReset();
    });

    it('resends a link for an unverified active user without revealing account existence', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-new',
        email: 'a@a.com',
        isActive: true,
        emailVerified: false,
        organizationId: null,
      });
      jwtService.sign.mockReturnValue('verify-token');
      mail.sendOrgEmail.mockResolvedValue({ sent: true });

      const result = await service.resendVerificationEmail('a@a.com', '1.1.1.1');

      expect(mail.sendOrgEmail).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('If the email exists, a verification link has been sent');
    });

    it('returns the generic message for a nonexistent email without sending', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerificationEmail('nope@a.com', '1.1.1.1');

      expect(mail.sendOrgEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('If the email exists, a verification link has been sent');
    });

    it('never resent to an already-verified emailed', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-new',
        email: 'a@a.com',
        isActive: true,
        emailVerified: true,
        organizationId: null,
      });

      const result = await service.resendVerificationEmail('a@a.com', '1.1.1.1');

      expect(mail.sendOrgEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('If the email exists, a verification link has been sent');
    });
  });

  describe('verifyEmailByCode', () => {
    const unverifiedUser = {
      id: 'user-code',
      email: 'a@a.com',
      name: 'A',
      role: 'USER',
      isActive: true,
      emailVerified: false,
      deletedAt: null,
      organizationId: null,
      createdAt: new Date('2024-01-01'),
      organization: null,
    };
    const verifiedUser = { ...unverifiedUser, emailVerified: true };

    beforeEach(() => {
      prisma.user.findUnique.mockReset();
      prisma.user.update.mockClear();
      prisma.onboardingSession.updateMany.mockReset();
      redis.get.mockReset();
      redis.delete.mockReset();
      (argon2.verify as jest.Mock).mockReset();
      jwtService.signAsync.mockReset();
      prisma.refreshToken.create.mockClear();
    });

    it('marks the user verified, binds the onboarding session, and mints an authenticated session (auto-continue)', async () => {
      redis.get.mockResolvedValue({ hash: 'code-hash', expiresAt: Date.now() + 120000 });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique
        .mockResolvedValueOnce(unverifiedUser)
        .mockResolvedValue(verifiedUser);
      prisma.onboardingSession.updateMany.mockResolvedValue({ count: 1 });
      jwtService.signAsync.mockResolvedValueOnce('access-1').mockResolvedValueOnce('refresh-1');

      const result = await service.verifyEmailByCode(
        { email: 'a@a.com', code: '123456' } as never,
        '1.1.1.1',
      );

      expect(redis.delete).toHaveBeenCalledWith(expect.stringContaining('auth:verify-code'));
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-code' },
        data: { emailVerified: true },
      });
      expect(prisma.onboardingSession.updateMany).toHaveBeenCalledWith({
        where: { email: 'a@a.com', userId: null },
        data: { userId: 'user-code' },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      );
      expect(result.user).toMatchObject({ id: 'user-code', email: 'a@a.com' });
    });

    it('rejects a wrong code without verifying or issuing tokens', async () => {
      redis.get.mockResolvedValue({ hash: 'code-hash', expiresAt: Date.now() + 120000 });
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);

      await expect(
        service.verifyEmailByCode({ email: 'a@a.com', code: '000000' } as never, '1.1.1.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.onboardingSession.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects an email with no issued (or already-consumed) code without verifying', async () => {
      redis.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);

      await expect(
        service.verifyEmailByCode({ email: 'a@a.com', code: '123456' } as never, '1.1.1.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects an expired code without verifying', async () => {
      redis.get.mockResolvedValue({ hash: 'code-hash', expiresAt: Date.now() - 1000 });
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);

      await expect(
        service.verifyEmailByCode({ email: 'a@a.com', code: '123456' } as never, '1.1.1.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(redis.delete).toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
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