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
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await argon2.hash(dto.password);

    try {
      const { user } = await this.prisma.$transaction(async (tx) => {
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

      const tokens = await this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ?? undefined,
      });

      return { user, ...tokens };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated. Contact your administrator.');
    }

    let isPasswordValid: boolean;
    try {
      isPasswordValid = await argon2.verify(user.password, dto.password);
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    });

    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, ...tokens };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<CurrentUserPayload>(refreshToken, {
        secret: this.configService.jwtRefreshSecret,
      });

      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Refresh token not found');
      }

      if (storedToken.expiresAt < new Date()) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
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
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedException('Account is deactivated. Contact your administrator.');
      }

      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

      const tokens = await this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ?? undefined,
      });

      return {
        user,
        ...tokens,
      };
    } catch {
      this.logger.error('Refresh token failed');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
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

    return user;
  }

  async generateTokens(payload: CurrentUserPayload): Promise<Tokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
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
}
