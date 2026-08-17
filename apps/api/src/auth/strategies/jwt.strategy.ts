import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.jwtSecret,
    });
  }

  async validate(payload: CurrentUserPayload): Promise<CurrentUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        organizationId: true,
        deletedAt: true,
        organization: { select: { isActive: true, suspendedAt: true, deletedAt: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // The JWT is loaded from current DB state, so a token issued before or
    // without verification is rejected the moment the account is unverified.
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email address before continuing');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }


    if (user.organizationId) {
      const orgUnavailable =
        !user.organization ||
        !user.organization.isActive ||
        user.organization.suspendedAt ||
        user.organization.deletedAt;

      if (orgUnavailable) {
        throw new UnauthorizedException('Organization access is suspended');
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? payload.organizationId,
      onboardingCompleted: payload.onboardingCompleted,
    };
  }
}
