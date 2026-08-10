import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { AssignPermissionsDto } from './dto/assign-permissions.dto';
import type { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import type { DuplicateRoleDto } from './dto/duplicate-role.dto';
import type { ClonePermissionsDto } from './dto/clone-permissions.dto';

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
        isSystem: false,
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

  async duplicateRole(orgId: string, roleId: string, dto: DuplicateRoleDto) {
    const source = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
      include: { rolePermissions: { select: { permissionId: true } } },
    });

    if (!source) {
      throw new NotFoundException('Role not found');
    }

    const name = (dto.name ?? `${source.name} Copy`).trim();

    const existing = await this.prisma.role.findUnique({
      where: { organizationId_name: { organizationId: orgId, name } },
    });

    if (existing) {
      throw new ConflictException(`Role "${name}" already exists in this organization`);
    }

    const copyPermissions = dto.copyPermissions ?? true;

    const created = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name,
          description: source.description,
          isSystem: false,
          organizationId: orgId,
        },
      });

      if (copyPermissions && source.rolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: source.rolePermissions.map((rp) => ({
            roleId: role.id,
            permissionId: rp.permissionId,
          })),
        });
      }

      return role;
    });

    this.logger.log(`Role duplicated: ${source.name} -> ${created.name} (${created.id})`);

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      isSystem: created.isSystem,
      organizationId: created.organizationId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      userCount: 0,
      permissionCount: copyPermissions ? source.rolePermissions.length : 0,
    };
  }

  async clonePermissions(orgId: string, roleId: string, dto: ClonePermissionsDto) {
    const [target, source] = await Promise.all([
      this.prisma.role.findFirst({ where: { id: roleId, organizationId: orgId } }),
      this.prisma.role.findFirst({ where: { id: dto.sourceRoleId, organizationId: orgId } }),
    ]);

    if (!target) {
      throw new NotFoundException('Role not found');
    }

    if (!source) {
      throw new NotFoundException('Source role not found');
    }

    if (target.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }

    if (source.id === target.id) {
      throw new BadRequestException('Source and target roles must be different');
    }

    const sourcePermissionIds = (
      await this.prisma.rolePermission.findMany({
        where: { roleId: source.id },
        select: { permissionId: true },
      })
    ).map((rp) => rp.permissionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: target.id } });

      if (sourcePermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: sourcePermissionIds.map((permissionId) => ({
            roleId: target.id,
            permissionId,
          })),
        });
      }
    });

    this.logger.log(
      `Permissions cloned from role ${source.name} to ${target.name}: ${sourcePermissionIds.length} permissions`,
    );

    return {
      message: `Permissions copied from "${source.name}" to "${target.name}"`,
      permissionCount: sourcePermissionIds.length,
    };
  }

  // ─── Role-Permission Assignment ────────────────────────────────

  async assignPermissions(orgId: string, roleId: string, dto: AssignPermissionsDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
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
      where: { id: userId, organizationId: orgId, deletedAt: null },
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
      where: { id: userId, organizationId: orgId, deletedAt: null },
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

  async userHasAllPermissions(userId: string, orgId: string, permissionNames: string[]): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId, orgId);
    return permissionNames.every((p) => userPerms.includes(p));
  }

  async userHasAnyPermission(userId: string, orgId: string, permissionNames: string[]): Promise<boolean> {
    const userPerms = new Set(await this.getUserPermissions(userId, orgId));
    return permissionNames.some((p) => userPerms.has(p));
  }

  /**
   * Guards role-assignment: a caller may only grant the organization Owner role
   * if they already hold `organization.manage` (the Owner-level permission).
   * Other roles (ADMIN/MANAGER/USER/VIEWER + custom) remain unrestricted so the
   * caller can assign them per their existing authorization.
   */
  async assertCanGrantOwnerRole(orgId: string, actorId: string, roleIds?: string[]): Promise<void> {
    if (!roleIds || roleIds.length === 0) return;

    const ownerRole = await this.prisma.role.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: 'Owner' } },
      select: { id: true },
    });

    if (!ownerRole || !roleIds.includes(ownerRole.id)) return;

    const canManage = await this.userHasAllPermissions(actorId, orgId, ['organization.manage']);
    if (!canManage) {
      throw new ForbiddenException(
        'You do not have permission to assign the Owner role',
      );
    }
  }

  async getMyPermissions(userId: string, orgId: string): Promise<string[]> {
    return this.getUserPermissions(userId, orgId);
  }
}
