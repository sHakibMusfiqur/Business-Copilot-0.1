import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

import type { QueryUsersDto } from './dto/query-users.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  async findAssignable(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        roleAssignments: {
          include: { role: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(orgId: string, query: QueryUsersDto) {
    const { page = 1, limit = 10, search, role, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.UserWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { email: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const allowedSortFields = ['name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt', 'lastLoginAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          roleAssignments: {
            select: {
              role: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        roleAssignments: {
          select: {
            role: { select: { id: true, name: true, isSystem: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(orgId: string, currentUserId: string, dto: CreateUserDto) {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot assign the SUPER_ADMIN role');
    }

    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.deletedAt) {
        throw new ConflictException('A previously deleted user with this email exists. Contact support to restore.');
      }
      throw new ConflictException('A user with this email already exists in the system');
    }

    const password = this.generateSecurePassword();
    const hashedPassword = await argon2.hash(password);

    await this.rbacService.assertCanGrantOwnerRole(orgId, currentUserId, dto.roleIds);

    let user: { id: string; email: string; name: string; role: string; isActive: boolean };
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: hashedPassword,
            name: dto.name.trim(),
            role: dto.role ?? UserRole.USER,
            isActive: dto.isActive ?? true,
            organizationId: orgId,
          },
        });

        await tx.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: orgId, userId: created.id } },
          update: {},
          create: {
            organizationId: orgId,
            userId: created.id,
            role: 'MEMBER',
          },
        });

        if (dto.roleIds && dto.roleIds.length > 0) {
          const roles = await tx.role.findMany({
            where: { id: { in: dto.roleIds }, organizationId: orgId },
          });

          if (roles.length !== dto.roleIds.length) {
            throw new NotFoundException('One or more roles not found');
          }

          await tx.userRoleAssignment.createMany({
            data: dto.roleIds.map((roleId) => ({
              userId: created.id,
              roleId,
            })),
          });
        }

        return created;
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists in the system');
      }
      throw error;
    }

    this.logger.log(`User created: ${user.email} (${user.id}) by ${currentUserId}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      temporaryPassword: password,
      message: 'User created successfully. Share the temporary password with the user.',
    };
  }

  async update(orgId: string, currentUserId: string, userId: string, dto: UpdateUserDto) {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot assign the SUPER_ADMIN role');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.isActive === false && userId === currentUserId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (dto.isActive === false) {
      await this.ensureNotLastOwner(orgId, userId);
    }

    if (dto.roleIds !== undefined) {
      await this.rbacService.ensureNotLastOwnerWithRole(orgId, userId, dto.roleIds);
      await this.rbacService.assertCanGrantOwnerRole(orgId, currentUserId, dto.roleIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {};

      if (dto.name !== undefined) {
        updateData.name = dto.name.trim();
      }
      if (dto.isActive !== undefined) {
        updateData.isActive = dto.isActive;
      }
      if (dto.role !== undefined) {
        updateData.role = dto.role;
      }

      const result = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      if (dto.roleIds !== undefined) {
        await tx.userRoleAssignment.deleteMany({ where: { userId } });

        if (dto.roleIds.length > 0) {
          const roles = await tx.role.findMany({
            where: { id: { in: dto.roleIds }, organizationId: orgId },
          });

          if (roles.length !== dto.roleIds.length) {
            throw new NotFoundException('One or more roles not found');
          }

          await tx.userRoleAssignment.createMany({
            data: dto.roleIds.map((roleId) => ({
              userId,
              roleId,
            })),
          });
        }
      }

      return result;
    });

    this.logger.log(`User updated: ${updated.email} (${userId}) by ${currentUserId}`);
    return updated;
  }

  async softDelete(orgId: string, currentUserId: string, userId: string) {
    if (userId === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.ensureNotLastOwner(orgId, userId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);

    this.logger.log(`User soft-deleted: ${user.email} (${userId}) by ${currentUserId}`);
    return { message: 'User deleted successfully' };
  }

  async updateStatus(orgId: string, currentUserId: string, userId: string, dto: UpdateUserStatusDto) {
    if (userId === currentUserId && !dto.isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (!dto.isActive) {
      await this.ensureNotLastOwner(orgId, userId);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!dto.isActive) {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`User ${dto.isActive ? 'activated' : 'deactivated'}: ${updated.email} (${userId}) by ${currentUserId}`);
    return updated;
  }

  private async ensureNotLastOwner(orgId: string, userId: string): Promise<void> {
    const ownerRole = await this.prisma.role.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: 'Owner' } },
    });

    if (!ownerRole) return;

    const hasOwnerRole = await this.prisma.userRoleAssignment.findUnique({
      where: { userId_roleId: { userId, roleId: ownerRole.id } },
    });

    if (!hasOwnerRole) return;

    const ownerCount = await this.prisma.userRoleAssignment.count({
      where: {
        roleId: ownerRole.id,
        user: { deletedAt: null, isActive: true },
      },
    });

    if (ownerCount <= 1) {
      throw new BadRequestException(
        'Cannot modify the last Owner. Assign another user to the Owner role first.',
      );
    }
  }

  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    const bytes = randomBytes(16);
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }
}
