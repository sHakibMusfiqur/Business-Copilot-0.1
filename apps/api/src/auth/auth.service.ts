import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { TokenExpiredError, JsonWebTokenError, NotBeforeError } from 'jsonwebtoken';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { ConfigService } from '../config/config.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../infrastructure/redis/redis.service';

import { AuditService } from '../audit/audit.service';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { redactString } from '../common/observability/redact';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyEmailCodeDto } from './dto/verify-email-code.dto';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const PASSWORD_RESET_ISSUER = 'bc-password-reset';
const PASSWORD_RESET_AUDIENCE = 'bc-password-reset-consume';
const PASSWORD_RESET_TTL = 60 * 60; // seconds

const VERIFY_EMAIL_ISSUER = 'bc-verify-email';
const VERIFY_EMAIL_AUDIENCE = 'bc-verify-email-consume';

// Email verification is offered as a 6-digit code in the onboarding wizard (and
// resend path) in addition to the purpose-bound JWT. The code is stored hashed,
// bound to the email, single-use, and short-lived.
const VERIFY_CODE_TTL = 15 * 60; // seconds
const VERIFY_CODE_STORAGE_PREFIX = 'auth:verify-code';
// How long a PendingRegistration is usable before it must be resubmitted. Aligned
// with the code TTL so a pending claim (and its code) expire together.
const PENDING_REGISTRATION_TTL = 15 * 60; // seconds

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rateLimiter: AuthRateLimiterService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto, ip: string, userAgent?: string) {
    // A real, usable account for this email (verified or deactivated) blocks
    // registration with a 409 that does not reveal whether it is usable.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, isActive: true, emailVerified: true },
    });
    if (existingUser?.emailVerified || (existingUser && !existingUser.isActive)) {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        action: 'REGISTER',
        status: 'FAILURE',
        entity: 'User',
        metadata: { email: dto.email, reason: 'Email already registered' },
        ipAddress: ip,
        userAgent,
      });
      throw new ConflictException('Email already registered');
    }

    // Employees join through invitations, never public registration. If a
    // pending invitation exists for this email, reject the signup and point
    // the user to their invitation link instead.
    const pendingInvitation = await this.prisma.invitation.findFirst({
      where: { email: dto.email, status: 'PENDING' },
      select: { id: true },
    });
    if (pendingInvitation) {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        action: 'REGISTER',
        status: 'FAILURE',
        entity: 'User',
        metadata: { email: dto.email, reason: 'Invitation pending; public registration blocked' },
        ipAddress: ip,
        userAgent,
      });
      throw new ConflictException(
        'This email has a pending invitation. Use your invitation link to join your organization instead.',
      );
    }

    // "Register" creates ONLY a PendingRegistration claim on the email. No real
    // User (so no authenticated/usable account, org, or provisioning) exists
    // until the 6-digit verification code proves ownership. Repeated submits for
    // an in-flight email reuse or replace the same pending record — never a
    // second User, and never a silent password overwrite.
    const now = Date.now();
    const expiresAt = new Date(now + PENDING_REGISTRATION_TTL * 1000);
    const existingPending = await this.prisma.pendingRegistration.findUnique({
      where: { email: dto.email },
    });

    if (existingPending && existingPending.expiresAt.getTime() > now) {
      // Still-valid pending claim: refresh only the display name and the
      // validity window. The stored password hash is preserved so a re-submit
      // never silently changes the account password.
      await this.prisma.pendingRegistration.update({
        where: { email: dto.email },
        data: { name: dto.name, expiresAt },
      });
    } else {
      // New claim, or an expired one is safe to replace wholesale.
      const hashedPassword = await argon2.hash(dto.password);
      await this.prisma.pendingRegistration.upsert({
        where: { email: dto.email },
        update: {
          name: dto.name,
          passwordHash: hashedPassword,
          expiresAt,
        },
        create: {
          email: dto.email,
          name: dto.name,
          passwordHash: hashedPassword,
          expiresAt,
        },
      });
    }

    // Issue + send a fresh 6-digit code (rotates any previously issued one). A
    // mail delivery failure must not fail registration; the user can resend.
    const emailResult = await this.sendVerificationCode(dto.email, null);

    await this.auditService.record({
      action: 'REGISTER',
      status: 'SUCCESS',
      entity: 'PendingRegistration',
      metadata: {
        email: dto.email,
        emailSent: emailResult.sent,
        reason: emailResult.sent
          ? 'Pending registration confirmed; verification code sent'
          : `Pending registration confirmed; email delivery failed (${emailResult.reason})`,
      },
      ipAddress: ip,
      userAgent,
    });

    // No access/refresh tokens here: no account exists until verification.
    return {
      email: dto.email,
      message: emailResult.sent
        ? 'If this email is new, a verification code has been sent. Check your inbox.'
        : 'Registration successful but the verification email could not be delivered. Please try resending.',
      emailSent: emailResult.sent,
    };
  }

  async login(dto: LoginDto, ip: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        password: true,
        role: true,
        isActive: true,
        emailVerified: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { isActive: true, suspendedAt: true, deletedAt: true } },
      },
    });

    if (!user) {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        action: 'FAILED_LOGIN',
        status: 'FAILURE',
        metadata: { email: dto.email, reason: 'User not found' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`user:${user.id}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        userId: user.id,
        action: 'FAILED_LOGIN',
        status: 'FAILURE',
        entity: 'User',
        entityId: user.id,
        metadata: { email: dto.email, reason: 'Account deactivated' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Account is deactivated. Contact your administrator.');
    }

    // An account that has not proven email ownership must not authenticate.
    if (!user.emailVerified) {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`user:${user.id}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        userId: user.id,
        action: 'FAILED_LOGIN',
        status: 'FAILURE',
        entity: 'User',
        entityId: user.id,
        metadata: { email: dto.email, reason: 'Email not verified' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Please verify your email address before signing in.');
    }

    // Users of a suspended, deleted or deactivated organization cannot sign in.
    // A missing organization relation while organizationId is set is an
    // inconsistent tenant state and must also be rejected.
    if (user.organizationId) {
      const orgUnavailable =
        !user.organization ||
        !user.organization.isActive ||
        user.organization.suspendedAt ||
        user.organization.deletedAt;

      if (orgUnavailable) {
        await this.rateLimiter.recordAttempt(`email:${dto.email}`);
        await this.rateLimiter.recordAttempt(`user:${user.id}`);
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        await this.auditService.record({
          userId: user.id,
          organizationId: user.organizationId ?? undefined,
          action: 'FAILED_LOGIN',
          status: 'FAILURE',
          entity: 'User',
          entityId: user.id,
          metadata: { email: dto.email, reason: 'Organization access suspended' },
          ipAddress: ip,
          userAgent,
        });
        throw new UnauthorizedException(
          'Organization access is suspended. Contact your administrator.',
        );
      }
    }

    let isPasswordValid: boolean;
    try {
      isPasswordValid = await argon2.verify(user.password, dto.password);
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`user:${user.id}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        userId: user.id,
        action: 'FAILED_LOGIN',
        status: 'FAILURE',
        entity: 'User',
        entityId: user.id,
        metadata: { email: dto.email, reason: 'Invalid password' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.rateLimiter.clearAttempts(`email:${dto.email}`);
    await this.rateLimiter.clearAttempts(`user:${user.id}`);
    await this.rateLimiter.clearAttempts(`ip:${ip}`);

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    });

    await this.auditService.record({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'LOGIN',
      status: 'SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    const { password: _, organization: _org, ...userWithoutPassword } = user;

    const onboardingCompleted = await this.getOnboardingCompleted(user);

    return { user: { ...userWithoutPassword, onboardingCompleted }, ...tokens };
  }

  async refreshToken(refreshToken: string, ip: string, userAgent?: string) {
    try {
      const payload = this.jwtService.verify<CurrentUserPayload>(refreshToken, {
        secret: this.configService.jwtRefreshSecret,
      });

      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken) {
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        if (payload?.id) await this.rateLimiter.recordAttempt(`user:${payload.id}`);
        await this.auditService.record({
          userId: payload?.id,
          action: 'REFRESH_TOKEN',
          status: 'FAILURE',
          metadata: { reason: 'Token not found in store' },
          ipAddress: ip,
          userAgent,
        });
        throw new UnauthorizedException('Refresh token not found');
      }

      if (storedToken.expiresAt < new Date()) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        await this.rateLimiter.recordAttempt(`user:${payload.id}`);
        await this.auditService.record({
          userId: payload.id,
          action: 'REFRESH_TOKEN',
          status: 'FAILURE',
          metadata: { reason: 'Token expired' },
          ipAddress: ip,
          userAgent,
        });
        throw new UnauthorizedException('Refresh token expired');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organizationId: true,
          isActive: true,
          emailVerified: true,
          deletedAt: true,
          organization: { select: { isActive: true, suspendedAt: true, deletedAt: true } },
        },
      });

      if (!user) {
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        await this.auditService.record({
          action: 'REFRESH_TOKEN',
          status: 'FAILURE',
          metadata: { reason: 'User not found', userId: payload.id },
          ipAddress: ip,
          userAgent,
        });
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        await this.rateLimiter.recordAttempt(`user:${user.id}`);
        await this.auditService.record({
          userId: user.id,
          action: 'REFRESH_TOKEN',
          status: 'FAILURE',
          entity: 'User',
          entityId: user.id,
          metadata: { reason: 'Account deactivated' },
          ipAddress: ip,
          userAgent,
        });
        throw new UnauthorizedException('Account is deactivated. Contact your administrator.');
      }

      // Unverified users must not obtain a fresh authenticated session.
      if (!user.emailVerified) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        await this.rateLimiter.recordAttempt(`user:${user.id}`);
        await this.auditService.record({
          userId: user.id,
          action: 'REFRESH_TOKEN',
          status: 'FAILURE',
          entity: 'User',
          entityId: user.id,
          metadata: { reason: 'Email not verified' },
          ipAddress: ip,
          userAgent,
        });
        throw new UnauthorizedException('Please verify your email address to continue.');
      }

      if (user.deletedAt) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        await this.rateLimiter.recordAttempt(`user:${user.id}`);
        await this.auditService.record({
          userId: user.id,
          action: 'REFRESH_TOKEN',
          status: 'FAILURE',
          entity: 'User',
          entityId: user.id,
          metadata: { reason: 'User soft-deleted' },
          ipAddress: ip,
          userAgent,
        });
        throw new UnauthorizedException('User not found');
      }

      if (user.organizationId) {
        const orgUnavailable =
          !user.organization ||
          !user.organization.isActive ||
          user.organization.suspendedAt ||
          user.organization.deletedAt;

        if (orgUnavailable) {
          await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
          await this.rateLimiter.recordAttempt(`ip:${ip}`);
          await this.rateLimiter.recordAttempt(`user:${user.id}`);
          await this.auditService.record({
            userId: user.id,
            organizationId: user.organizationId ?? undefined,
            action: 'REFRESH_TOKEN',
            status: 'FAILURE',
            entity: 'User',
            entityId: user.id,
            metadata: { reason: 'Organization access suspended' },
            ipAddress: ip,
            userAgent,
          });
          throw new UnauthorizedException(
            'Organization access is suspended. Contact your administrator.',
          );
        }
      }

      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

      await this.rateLimiter.clearAttempts(`ip:${ip}`);
      await this.rateLimiter.clearAttempts(`user:${user.id}`);

      const tokens = await this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ?? undefined,
      });

      await this.auditService.record({
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        action: 'REFRESH_TOKEN',
        status: 'SUCCESS',
        entity: 'User',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
      });

      const onboardingCompleted = await this.getOnboardingCompleted(user);

      return {
        user: { ...user, onboardingCompleted },
        ...tokens,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      // JWT verification failures are expected for expired / tampered tokens and
      // do not indicate a system error.  Throw a clean UnauthorizedException so
      // the client receives a 401 without an opaque ERROR polluting the logs.
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Refresh token expired');
      }
      if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Anything else (DB errors, unexpected runtime failures) is genuinely
      // unexpected and should be logged with enough detail to diagnose.
      this.logger.error(
        `Refresh token failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async forgotPassword(email: string, ip: string, userAgent?: string): Promise<void> {
    if (!email) {
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        action: 'FORGOT_PASSWORD',
        status: 'FAILURE',
        metadata: { reason: 'Email not provided' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Email is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, organizationId: true },
    });

    if (user) {
      await this.rateLimiter.clearAttempts(`email:${email}`);
      this.logger.log(`Password reset requested for ${email}`);

      try {
        const resetToken = this.jwtService.sign(
          { sub: user.id, purpose: 'password-reset' },
          {
            secret: this.configService.jwtSecret,
            expiresIn: PASSWORD_RESET_TTL,
            issuer: PASSWORD_RESET_ISSUER,
            audience: PASSWORD_RESET_AUDIENCE,
          },
        );
        const resetUrl = `${this.configService.webUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
        const result = await this.mailService.sendOrgEmail(user.organizationId, {
          to: user.email,
          type: 'passwordReset',
          data: { passwordReset: { resetUrl } },
        });
        if (!result.sent) {
          this.logger.warn(`Password reset email not delivered for ${email} (${result.reason})`);
        }
      } catch (error) {
        this.logger.error(`Failed to send password reset email for ${email}: ${(error as Error).message}`);
      }

      await this.auditService.record({
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        action: 'FORGOT_PASSWORD',
        status: 'SUCCESS',
        entity: 'User',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
      });
    } else {
      await this.rateLimiter.recordAttempt(`email:${email}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        action: 'FORGOT_PASSWORD',
        status: 'FAILURE',
        metadata: { email, reason: 'Email not found' },
        ipAddress: ip,
        userAgent,
      });
    }
  }

  async resetPassword(token: string, newPassword: string, ip?: string, userAgent?: string): Promise<{ message: string }> {
    let payload: { sub?: string; purpose?: string; iat?: number };
    try {
      payload = this.jwtService.verify<{ sub?: string; purpose?: string; iat?: number }>(token, {
        secret: this.configService.jwtSecret,
        issuer: PASSWORD_RESET_ISSUER,
        audience: PASSWORD_RESET_AUDIENCE,
      });
    } catch {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    if (payload.purpose !== 'password-reset' || !payload.sub) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, organizationId: true, deletedAt: true, isActive: true, updatedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }
    if (!user.isActive) {
      throw new BadRequestException('This account has been deactivated');
    }

    // Reject reuse of a password-reset token. After a successful reset the
    // user's updatedAt is advanced by Prisma's @updatedAt directive. Any
    // older token (iat < updatedAt) is therefore stale and must be rejected.
    if (payload.iat && user.updatedAt) {
      const tokenIssuedAt = payload.iat * 1000; // jwt iat is in seconds
      if (tokenIssuedAt < user.updatedAt.getTime()) {
        throw new BadRequestException('This reset link has already been used');
      }
    }

    const hashedPassword = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Invalidate all existing sessions so a leaked token cannot be reused.
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    await this.auditService.record({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'PASSWORD_RESET',
      status: 'SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    return { message: 'Password reset successfully. You can now sign in.' };
  }

  async verifyEmail(token: string, ip: string, userAgent?: string): Promise<{ message: string }> {
    let payload: { sub?: string; purpose?: string; email?: string };
    try {
      payload = this.jwtService.verify<{ sub?: string; purpose?: string; email?: string }>(token, {
        secret: this.configService.jwtSecret,
        issuer: VERIFY_EMAIL_ISSUER,
        audience: VERIFY_EMAIL_AUDIENCE,
      });
    } catch {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    if (payload.purpose !== 'verify-email' || !payload.sub) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isActive: true, emailVerified: true, deletedAt: true, organizationId: true },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }
    if (!user.isActive) {
      throw new BadRequestException('This account has been deactivated');
    }
    // The token is bound to the email it was issued for, so it can never verify
    // a different account even if the userId claim were replayed.
    if (payload.email && user.email !== payload.email) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    if (user.emailVerified) {
      return { message: 'Your email is already verified. You can now sign in.' };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await this.auditService.record({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'VERIFY_EMAIL',
      status: 'SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    return { message: 'Email verified successfully. You can now sign in.' };
  }

  async resendVerificationEmail(email: string, ip: string, userAgent?: string): Promise<{ message: string; emailSent: boolean }> {
    // The pending registration — not a real User — is the claim being verified.
    // Never reveal whether (or in what state) a registration exists.
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });

    const notFound = async (reason: string) => {
      await this.rateLimiter.recordAttempt(`email:${email}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        action: 'RESEND_VERIFICATION',
        status: 'FAILURE',
        metadata: { email, reason },
        ipAddress: ip,
        userAgent,
      });
      return { message: 'If the email exists, a verification code has been sent', emailSent: false };
    };

    if (!pending) return notFound('No pending registration');

    // Expired pending registrations are safe to drop: re-registering creates a
    // fresh claim and never a duplicate User.
    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.prisma.pendingRegistration.delete({ where: { email } }).catch(() => undefined);
      return notFound('Pending registration expired');
    }

    const emailResult = await this.sendVerificationCode(email, null);

    await this.auditService.record({
      action: 'RESEND_VERIFICATION',
      status: 'SUCCESS',
      entity: 'PendingRegistration',
      metadata: { email, emailSent: emailResult.sent },
      ipAddress: ip,
      userAgent,
    });

    return {
      message: emailResult.sent
        ? 'If the email exists, a verification code has been sent'
        : 'A verification code was generated but the email could not be delivered. Please try again.',
      emailSent: emailResult.sent,
    };
  }

  async verifyEmailByCode(
    dto: VerifyEmailCodeDto,
    ip: string,
    userAgent?: string,
  ): Promise<{ user: Record<string, unknown>; accessToken: string; refreshToken: string }> {
    this.logger.log(`Verification by code requested for ${dto.email}`);

    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email: dto.email },
    });

    const reject = async (userId?: string) => {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      if (userId) await this.rateLimiter.recordAttempt(`user:${userId}`);
      await this.auditService.record({
        userId,
        action: 'VERIFY_EMAIL_CODE',
        status: 'FAILURE',
        entity: 'User',
        entityId: userId,
        metadata: { email: dto.email, reason: 'Invalid verification code' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid verification code');
    };

    // Without a pending registration there is nothing to verify (and no User).
    if (!pending) return reject();

    const key = this.verifyCodeKey(dto.email);
    const stored = await this.redis.get<{ hash: string; expiresAt: number }>(key);
    if (!stored || typeof stored.expiresAt !== 'number' || !stored.hash) {
      return reject();
    }
    if (stored.expiresAt < Date.now()) {
      await this.redis.delete(key);
      return reject();
    }

    let matches = false;
    try {
      matches = await argon2.verify(stored.hash, dto.code);
    } catch {
      matches = false;
    }
    if (!matches) {
      return reject();
    }

    // An expired pending registration cannot be promoted. Drop the stale claim
    // so it can be re-registered cleanly; no User is created here.
    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.redis.delete(key);
      await this.prisma.pendingRegistration.delete({ where: { email: dto.email } }).catch(() => undefined);
      return reject();
    }

    // Consume the single-use code before committing so a failed write never
    // leaves a replayable code behind.
    await this.redis.delete(key);

    // Promote the pending claim into the real User — exactly once. With the
    // claim removed below and User.email unique, no two verifications can create
    // two accounts for the same email.
    let userId: string;
    let promoted = false;
    try {
      const created = await this.prisma.user.create({
        data: {
          email: pending.email,
          name: pending.name,
          password: pending.passwordHash,
          role: 'USER',
          emailVerified: true,
        },
        select: { id: true },
      });
      userId = created.id;
      promoted = true;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        // A legacy unverified User already exists for this email (created before
        // verification enforcement). Verify it in place rather than create or
        // overwrite anything. emailVerified is only ever switched ON here.
        const existing = await this.prisma.user.findUnique({
          where: { email: pending.email },
          select: { id: true },
        });
        if (!existing) throw error;
        userId = existing.id;
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { emailVerified: true },
        });
      } else {
        throw error;
      }
    }

    // Bind the verified user to any anonymous onboarding session created at
    // registration (provisioning requires a bound + verified user). Sessions are
    // matched by email because they are created after the pending claim.
    await this.prisma.onboardingSession.updateMany({
      where: { email: pending.email, userId: null },
      data: { userId },
    });

    // The claim is now redundant; drop it so the code cannot be replayed and a
    // future register starts from a clean slate. P2002 is impossible here.
    await this.prisma.pendingRegistration.delete({ where: { email: pending.email } }).catch(() => undefined);

    await this.rateLimiter.clearAttempts(`email:${dto.email}`);
    await this.rateLimiter.clearAttempts(`user:${userId}`);
    await this.rateLimiter.clearAttempts(`ip:${ip}`);

    await this.auditService.record({
      userId,
      action: 'VERIFY_EMAIL',
      status: 'SUCCESS',
      entity: 'User',
      entityId: userId,
      metadata: { email: pending.email, promoted: promoted ? 'pending' : 'legacy' },
      ipAddress: ip,
      userAgent,
    });

    // Verification proves email ownership, so this is the first legitimate point
    // to mint a session and let the user continue onboarding seamlessly. It is
    // explicitly NOT a login (no password) but the account has now proven the
    // email it registered with, satisfying the same bar as login's verified gate.
    return this.issueAuthenticatedSession(userId, ip, userAgent);
  }

  private async issueAuthenticatedSession(
    userId: string,
    ip: string,
    userAgent?: string,
  ): Promise<{ user: Record<string, unknown>; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        deletedAt: true,
        organizationId: true,
        createdAt: true,
        organization: { select: { isActive: true, suspendedAt: true, deletedAt: true } },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid verification code');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email address before signing in.');
    }
    if (user.organizationId) {
      const orgUnavailable =
        !user.organization ||
        !user.organization.isActive ||
        user.organization.suspendedAt ||
        user.organization.deletedAt;
      if (orgUnavailable) {
        throw new UnauthorizedException('Organization access is suspended. Contact your administrator.');
      }
    }

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    });

    await this.auditService.record({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'LOGIN',
      status: 'SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    const onboardingCompleted = await this.getOnboardingCompleted(user);
    return { user: { ...user, onboardingCompleted }, ...tokens };
  }

  private async sendVerificationCode(
    email: string,
    orgId: string | null,
  ): Promise<{ sent: boolean; reason?: string }> {
    const domain = email.split('@')[1] ?? 'unknown';
    this.logger.log(`Verification code requested for domain=${domain}`);
    try {
      const code = this.generateVerifyCode();
      const codeHash = await argon2.hash(code);
      const key = this.verifyCodeKey(email);
      await this.redis.delete(key);
      await this.redis.set(
        key,
        { hash: codeHash, expiresAt: Date.now() + VERIFY_CODE_TTL * 1000 },
        { ttlSeconds: VERIFY_CODE_TTL },
      );
      this.logger.log(`Verification code persisted in Redis for domain=${domain}, ttl=${VERIFY_CODE_TTL}s`);
      const result = await this.mailService.sendOrgEmail(orgId, {
        to: email,
        type: 'emailVerification',
        data: { emailVerification: { code, expiresInHours: VERIFY_CODE_TTL / 3600 } },
      });
      if (result.sent) {
        this.logger.log(`Verification email sent successfully to domain=${domain}`);
      } else {
        this.logger.warn(`Verification email not delivered to domain=${domain} (reason=${result.reason})`);
      }
      return { sent: result.sent, reason: result.reason };
    } catch (error) {
      const reason = (error as Error).message;
      this.logger.error(`Verification code flow failed for domain=${domain}: ${reason}`);
      return { sent: false, reason: 'send-failed' };
    }
  }

  private verifyCodeKey(email: string): string {
    return `${VERIFY_CODE_STORAGE_PREFIX}:${email.trim().toLowerCase()}`;
  }

  private generateVerifyCode(): string {
    return String(randomInt(0, 1000000)).padStart(6, '0');
  }

  async logout(userId: string, ip?: string, userAgent?: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true },
    });

    await this.auditService.record({
      userId,
      organizationId: user?.organizationId ?? undefined,
      action: 'LOGOUT',
      status: 'SUCCESS',
      entity: 'User',
      entityId: userId,
      ipAddress: ip,
      userAgent,
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const onboardingCompleted = await this.getOnboardingCompleted(user);

    return { ...user, onboardingCompleted };
  }

  async generateTokens(payload: CurrentUserPayload): Promise<Tokens> {
    const onboardingCompleted = await this.getOnboardingCompleted(payload);
    const enrichedPayload: CurrentUserPayload = { ...payload, onboardingCompleted };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(enrichedPayload),
      this.jwtService.signAsync(enrichedPayload, {
        secret: this.configService.jwtRefreshSecret,
        expiresIn: this.configService.jwtRefreshExpiresIn as JwtSignOptions['expiresIn'],
      }),
    ]);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // SECURITY NOTE: refresh tokens are persisted as-is (plaintext) rather than
    // as a hash. A refresh token is high-entropy, opaque, short-lived (7d) and is
    // only matched on exact value, so at-rest storage does not need to be
    // reversible anywhere. Hashing would require storing the hash and matching
    // on lookup (which already returns the raw token for rotation), so it would
    // add no protection unless the DB were gained-secrets-alongside-hashes;
    // a thorough design (opaque uuid stored hashed + server-side rotation) is
    // tracked as hardening debt. Tokens rotate on every refresh, bounding
    // exposure. Access tokens are never persisted.
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async getOnboardingCompleted(user: {
    id: string;
    email?: string | null;
    organizationId?: string | null;
  }): Promise<boolean> {
    if (!user.id) return false;
    const session = await this.prisma.onboardingSession.findFirst({
      where: {
        OR: [
          { userId: user.id },
          ...(user.email ? [{ email: user.email }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { provisionStatus: true },
    });
    if (session) return session.provisionStatus === 'COMPLETED';
    // No onboarding session on record means the user was not created through
    // the registration flow (seeded/admin-created). Registration assigns no
    // organization, so an organization here is a real, pre-existing workspace.
    return !!user.organizationId;
  }

  /** Secret values used to prevent credential echo when logging error details. */
  private authSecretValues(): string[] {
    const values: string[] = [];
    for (const v of [
      this.configService.redisUrl,
      this.configService.jwtSecret,
      this.configService.jwtRefreshSecret,
      this.configService.stripeSecretKey,
      this.configService.stripeWebhookSecret,
      process.env.DATABASE_URL,
    ]) {
      if (v) values.push(v);
    }
    return values;
  }

  private redact(message: string, secrets: string[]): string {
    return redactString(message, secrets);
  }
}
