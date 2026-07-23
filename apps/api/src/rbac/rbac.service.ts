import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { AssignPermissionsDto } from './dto/assign-permissions.dto';
import type { AssignUserRolesDto } from './dto/assign-user-roles.dto';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Permissions ───────────────────────────────────────────────

  async findAllPermissions(orgId: string) {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
      include: {
        rolePermissions: {
          where: { role: { organizationId: orgId } },
          select: { roleId: true },
        },
      },
    });
  }

  async findPermissionsGrouped(orgId: string) {
    const permissions = await this.findAllPermissions(orgId);
    const grouped: Record<string, typeof permissions> = {};

    for (const perm of permissions) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    }

    return grouped;
  }

  // ─── Roles ─────────────────────────────────────────────────────

  async findAllRoles(orgId: string) {
    const roles = await this.prisma.role.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            userAssignments: true,
            rolePermissions: true,
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      organizationId: role.organizationId,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userAssignments,
      permissionCount: role._count.rolePermissions,
    }));
  }

  async findRoleById(orgId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: {
          select: { userAssignments: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      organizationId: role.organizationId,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userAssignments,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }

  async createRole(orgId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists in this organization`);
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        isSystem: dto.isSystem ?? false,
        organizationId: orgId,
      },
    });

    this.logger.log(`Role created: ${role.name} (${role.id})`);

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      organizationId: role.organizationId,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: 0,
      permissionCount: 0,
    };
  }

  async updateRole(orgId: string, roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { organizationId_name: { organizationId: orgId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException(`Role "${dto.name}" already exists`);
      }
    }

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isSystem !== undefined && { isSystem: dto.isSystem }),
      },
    });

    this.logger.log(`Role updated: ${updated.name} (${updated.id})`);

    return updated;
  }

  async deleteRole(orgId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    await this.prisma.role.delete({ where: { id: roleId } });

    this.logger.log(`Role deleted: ${role.name} (${role.id})`);
  }

  // ─── Role-Permission Assignment ────────────────────────────────

  async assignPermissions(orgId: string, roleId: string, dto: AssignPermissionsDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: dto.permissionNames } },
    });

    if (permissions.length !== dto.permissionNames.length) {
      const foundNames = permissions.map((p) => p.name);
      const missing = dto.permissionNames.filter((n) => !foundNames.includes(n));
      throw new NotFoundException(`Permissions not found: ${missing.join(', ')}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId,
            permissionId: perm.id,
          })),
        });
      }
    });

    this.logger.log(`Permissions assigned to role ${role.name}: ${dto.permissionNames.join(', ')}`);
  }

  async getRolePermissions(orgId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.prisma.permission.findMany({
      where: {
        rolePermissions: {
          some: { roleId },
        },
      },
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
  }

  // ─── User-Role Assignment ─────────────────────────────────────

  async assignUserRoles(orgId: string, userId: string, dto: AssignUserRolesDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds }, organizationId: orgId },
    });

    if (roles.length !== dto.roleIds.length) {
      throw new NotFoundException('One or more roles not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId } });

      if (roles.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: roles.map((role) => ({
            userId,
            roleId: role.id,
          })),
        });
      }
    });

    this.logger.log(`Roles assigned to user ${userId}: ${roles.map((r) => r.name).join(', ')}`);
  }

  async getUserRoles(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    return this.prisma.role.findMany({
      where: {
        userAssignments: { some: { userId } },
        organizationId: orgId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findUsersInOrganization(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
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

  // ─── Permission Resolution ─────────────────────────────────────

  async getUserPermissions(userId: string, orgId: string): Promise<string[]> {
    const result = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          organizationId: orgId,
          userAssignments: { some: { userId } },
        },
      },
      select: { permission: { select: { name: true } } },
    });

    return [...new Set(result.map((rp) => rp.permission.name))];
  }

  async userHasPermission(userId: string, orgId: string, permissionName: string): Promise<boolean> {
    const count = await this.prisma.rolePermission.count({
      where: {
        role: {
          organizationId: orgId,
          userAssignments: { some: { userId } },
        },
        permission: { name: permissionName },
      },
    });

    return count > 0;
  }

  async userHasAllPermissions(userId: string, orgId: string, permissionNames: string[]): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId, orgId);
    return permissionNames.every((p) => userPerms.includes(p));
  }

  async userHasAnyPermission(userId: string, orgId: string, permissionNames: string[]): Promise<boolean> {
    const userPerms = new Set(await this.getUserPermissions(userId, orgId));
    return permissionNames.some((p) => userPerms.has(p));
  }
}
