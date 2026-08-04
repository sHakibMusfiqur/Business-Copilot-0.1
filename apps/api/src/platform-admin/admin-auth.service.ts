import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuthService } from '../auth/auth.service';
import { AuthRateLimiterService } from '../auth/auth-rate-limiter.service';
import type { LoginDto } from '../auth/dto/login.dto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Platform Console authentication. Functionally independent from the
 * organization auth flow: only a SUPER_ADMIN account may authenticate here,
 * audit entries use dedicated actions, and failures never reveal whether an
 * account exists. Token/session issuance reuses the shared AuthService
 * primitive (`generateTokens`) without modifying it.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly rateLimiter: AuthRateLimiterService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        action: 'FAILED_ADMIN_LOGIN',
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
        action: 'FAILED_ADMIN_LOGIN',
        status: 'FAILURE',
        entity: 'User',
        entityId: user.id,
        metadata: { email: dto.email, reason: 'Account deactivated' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Account is deactivated. Contact your administrator.');
    }

    // The Platform Console is reserved for SUPER_ADMIN accounts. Organization
    // users must never authenticate here; surface the exact same error as a
    // bad password so the existence of any account is never revealed.
    if (user.role !== 'SUPER_ADMIN') {
      await this.rateLimiter.recordAttempt(`email:${dto.email}`);
      await this.rateLimiter.recordAttempt(`user:${user.id}`);
      await this.rateLimiter.recordAttempt(`ip:${ip}`);
      await this.auditService.record({
        userId: user.id,
        action: 'FAILED_ADMIN_LOGIN',
        status: 'FAILURE',
        entity: 'User',
        entityId: user.id,
        metadata: { email: dto.email, reason: 'User is not a platform administrator' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
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
        action: 'FAILED_ADMIN_LOGIN',
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

    const tokens = await this.authService.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    });

    await this.auditService.record({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'ADMIN_LOGIN',
      status: 'SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: { ...userWithoutPassword, onboardingCompleted: !!user.organizationId },
      ...tokens,
    };
  }
}
