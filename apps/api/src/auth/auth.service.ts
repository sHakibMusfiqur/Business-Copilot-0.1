import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { ConfigService } from '../config/config.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rateLimiter: AuthRateLimiterService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ip: string, userAgent?: string) {
    this.logger.log(`=== AUTH SERVICE register() ENTERED: email=${dto.email} ip=${ip} ===`);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
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

    this.logger.log(`=== AUTH SERVICE about to hash password ===`);
    const hashedPassword = await argon2.hash(dto.password);
    this.logger.log(`=== AUTH SERVICE password hashed successfully ===`);

    try {
      this.logger.log(`=== AUTH SERVICE entering Prisma $transaction ===`);
      const { user } = await this.prisma.$transaction(async (tx) => {
        this.logger.log(`=== TRANSACTION: creating user ===`);
        const createdUser = await tx.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            name: dto.name,
            role: 'USER',
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        });

        const baseSlug = dto.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `org-${createdUser.id.slice(0, 8)}`;

        let slug = baseSlug;
        let suffix = 2;
        while (await tx.organization.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${suffix}`;
          suffix++;
        }

        const orgName = `${dto.name}'s Organization`;

        const org = await tx.organization.create({
          data: { name: orgName, slug },
        });

        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: createdUser.id,
            role: 'OWNER',
          },
        });

        const allPermissions = await tx.permission.findMany({ select: { id: true } });

        const ownerRole = await tx.role.create({
          data: {
            name: 'Owner',
            description: 'Full access to all organization features',
            isSystem: true,
            organizationId: org.id,
          },
        });

        if (allPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: allPermissions.map((perm) => ({
              roleId: ownerRole.id,
              permissionId: perm.id,
            })),
          });
        }

        await tx.userRoleAssignment.create({
          data: {
            userId: createdUser.id,
            roleId: ownerRole.id,
          },
        });

        const updatedUser = await tx.user.update({
          where: { id: createdUser.id },
          data: { organizationId: org.id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
            createdAt: true,
          },
        });

        return { user: updatedUser, organization: org };
      });
      this.logger.log(`=== AUTH SERVICE Prisma $transaction completed successfully ===`);

      await this.rateLimiter.clearAttempts(`email:${user.email}`);
      await this.rateLimiter.clearAttempts(`ip:${ip}`);

      this.logger.log(`=== AUTH SERVICE generating tokens ===`);
      const tokens = await this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ?? undefined,
      });

      await this.auditService.record({
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        action: 'REGISTER',
        status: 'SUCCESS',
        entity: 'User',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
      });

      this.logger.log(`=== AUTH SERVICE register() returning successfully ===`);
      const onboardingCompleted = await this.getOnboardingCompleted(user);
      return { user: { ...user, onboardingCompleted }, ...tokens };
    } catch (error) {
      this.logger.error(`=== AUTH SERVICE register() CAUGHT EXCEPTION ===`);
      this.logger.error(`error type=${typeof error} ${error instanceof Error ? error.constructor.name : 'unknown'}`);
      this.logger.error(`error message=${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error) {
        this.logger.error(`error stack=${error.stack}`);
      }
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const meta = error.meta as Record<string, unknown> | undefined;
        const modelName = meta?.modelName as string | undefined;
        const target = meta?.target as string | string[] | undefined;
        const fields = Array.isArray(target) ? target : target ? [target] : [];

        if (modelName === 'Organization') {
          if (fields.includes('name')) {
            throw new ConflictException('Organization name already exists');
          }
          if (fields.includes('slug')) {
            throw new ConflictException('Organization slug already exists');
          }
        }

        await this.rateLimiter.recordAttempt(`email:${dto.email}`);
        await this.rateLimiter.recordAttempt(`ip:${ip}`);
        await this.auditService.record({
          action: 'REGISTER',
          status: 'FAILURE',
          entity: 'User',
          metadata: { email: dto.email, reason: 'Unique constraint violation' },
          ipAddress: ip,
          userAgent,
        });
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, ip: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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

    const { password: _, ...userWithoutPassword } = user;

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
      this.logger.error('Refresh token failed');
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
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private async getOnboardingCompleted(user: {
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
    // the registration flow (seeded/admin-created). A placeholder org is
    // always paired with an onboarding session, so an org here is a real,
    // pre-existing workspace.
    return !!user.organizationId;
  }
}
