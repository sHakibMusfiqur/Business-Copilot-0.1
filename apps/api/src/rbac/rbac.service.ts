import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { AssignPermissionsDto } from './dto/assign-permissions.dto';
import type { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import type { DuplicateRoleDto } from './dto/duplicate-role.dto';
import type { ClonePermissionsDto } from './dto/clone-permissions.dto';

/**
 * Permissions that define organization scoping/ownership and must never be
 * copied onto an arbitrary role. Cannot be granted via `assignPermissions` or
 * cloned, regardless of the actor's own permission set. This is the primary
 * privilege-escalation barrier: `organization.manage` identifies the Owner, so
 * it is conveyed only through the Owner role, never by duplicating the token.
 */
const NON_DELEGABLE_PERMISSIONS: ReadonlySet<string> = new Set([
  'organization.manage',
]);

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a security-sensitive role/permission change to the AuditLog table.
   * Mirrors AuditService.record but writes directly so RbacModule avoids a
   * circular module dependency (AuditModule already imports RbacModule). Never
   * throws: audit failures must not block the underlying role operation.
   */
  private async recordAudit(params: {
    userId?: string;
    organizationId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          organizationId: params.organizationId ?? null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId ?? null,
          status: 'SUCCESS',
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record role audit log: ${(error as Error).message}`);
    }
  }

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

  async createRole(orgId: string, dto: CreateRoleDto, actorId?: string) {
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
    await this.recordAudit({
      userId: actorId,
      organizationId: orgId,
      action: 'ROLE.CREATE',
      entity: 'role',
      entityId: role.id,
      metadata: { name: role.name, description: role.description },
    });

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

  async updateRole(orgId: string, roleId: string, dto: UpdateRoleDto, actorId?: string) {
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
    await this.recordAudit({
      userId: actorId,
      organizationId: orgId,
      action: 'ROLE.UPDATE',
      entity: 'role',
      entityId: roleId,
      metadata: { name: updated.name, description: updated.description },
    });

    return updated;
  }

  async deleteRole(orgId: string, roleId: string, actorId?: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    const assignedUsers = await this.prisma.userRoleAssignment.count({
      where: { roleId },
    });

    if (assignedUsers > 0) {
      throw new BadRequestException(
        `Role "${role.name}" is assigned to ${assignedUsers} user(s). Reassign them to another role before deleting.`,
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });

    this.logger.log(`Role deleted: ${role.name} (${role.id})`);
    await this.recordAudit({
      userId: actorId,
      organizationId: orgId,
      action: 'ROLE.DELETE',
      entity: 'role',
      entityId: roleId,
      metadata: { name: role.name },
    });
  }

  async duplicateRole(orgId: string, roleId: string, dto: DuplicateRoleDto, actorId?: string) {
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

    // Duplication copies the source permission set, so it is a grant operation:
    // the actor must be allowed to delegate every permission being copied.
    if (copyPermissions && actorId && source.rolePermissions.length > 0) {
      const copiedNames = (
        await this.prisma.permission.findMany({
          where: { id: { in: source.rolePermissions.map((rp) => rp.permissionId) } },
          select: { name: true },
        })
      ).map((p) => p.name);
      await this.assertCanGrantPermissions(orgId, actorId, copiedNames);
    }

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
    await this.recordAudit({
      userId: actorId,
      organizationId: orgId,
      action: 'ROLE.DUPLICATE',
      entity: 'role',
      entityId: created.id,
      metadata: {
        sourceRoleId: source.id,
        sourceRoleName: source.name,
        name: created.name,
        copyPermissions,
      },
    });

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

  async clonePermissions(orgId: string, roleId: string, dto: ClonePermissionsDto, actorId?: string) {
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

    // Clone is a permission grant operation — the actor must be allowed to
    // delegate every permission being copied.
    if (sourcePermissionIds.length > 0) {
      const sourceNames = (
        await this.prisma.permission.findMany({
          where: { id: { in: sourcePermissionIds } },
          select: { name: true },
        })
      ).map((p) => p.name);
      await this.assertCanGrantPermissions(orgId, actorId, sourceNames);
    }

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
    await this.recordAudit({
      userId: actorId,
      organizationId: orgId,
      action: 'ROLE.PERMISSIONS.CLONE',
      entity: 'role',
      entityId: target.id,
      metadata: {
        targetRoleId: target.id,
        targetRoleName: target.name,
        sourceRoleId: source.id,
        sourceRoleName: source.name,
        permissionCount: sourcePermissionIds.length,
      },
    });

    return {
      message: `Permissions copied from "${source.name}" to "${target.name}"`,
      permissionCount: sourcePermissionIds.length,
    };
  }

  // ─── Role-Permission Assignment ────────────────────────────────

  async assignPermissions(orgId: string, roleId: string, dto: AssignPermissionsDto, actorId?: string) {
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

    await this.assertCanGrantPermissions(orgId, actorId, dto.permissionNames);

    // Best-effort diff of granted vs removed permissions for the audit trail.
    let existingPermissionIds: string[] = [];
    try {
      existingPermissionIds = (
        await this.prisma.rolePermission.findMany({
          where: { roleId },
          select: { permissionId: true },
        })
      ).map((rp) => rp.permissionId);
    } catch {
      // audit diff is best-effort; selection still proceeds
    }

    const newIds = permissions.map((p) => p.id);
    const nameById = new Map(permissions.map((p) => [p.id, p.name]));
    const nameOf = (id: string) => nameById.get(id) ?? id;
    const addedNames = newIds.filter((id) => !existingPermissionIds.includes(id)).map(nameOf);
    const removedIds = existingPermissionIds.filter((id) => !newIds.includes(id));

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
    await this.recordAudit({
      userId: actorId,
      organizationId: orgId,
      action: 'ROLE.PERMISSIONS.UPDATE',
      entity: 'role',
      entityId: roleId,
      metadata: {
        roleName: role.name,
        permissionsGranted: addedNames,
        permissionIdsRemoved: removedIds,
        permissions: dto.permissionNames,
      },
    });
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

  async assignUserRoles(orgId: string, userId: string, dto: AssignUserRolesDto, actorId?: string) {
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

    await this.ensureNotLastOwnerWithRole(orgId, userId, dto.roleIds);

    const roleNames = roles.map((r) => r.name);

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

    this.logger.log(`Roles assigned to user ${userId}: ${roleNames.join(', ')}`);
    await this.recordAudit({
      userId: actorId,
      organizationId: orgId,
      action: 'ROLE.ASSIGN',
      entity: 'user',
      entityId: userId,
      metadata: { roleIds: dto.roleIds, roleNames },
    });
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


  async getRoleUsers(orgId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found in this organization');
    }

    return this.prisma.user.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        roleAssignments: { some: { roleId } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isActive: true,
        roleAssignments: {
          select: { role: { select: { id: true, name: true, isSystem: true } } },
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

  async getUserEffectivePermissions(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            isSystem: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    id: true,
                    name: true,
                    module: true,
                    label: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const roles = assignments.map((a) => ({
      id: a.role.id,
      name: a.role.name,
      isSystem: a.role.isSystem,
    }));

    // Build permission → source roles mapping
    const permissionMap = new Map<
      string,
      {
        id: string;
        name: string;
        module: string;
        label: string;
        sourceRoles: Array<{ id: string; name: string }>;
      }
    >();

    for (const assignment of assignments) {
      for (const rp of assignment.role.rolePermissions) {
        const perm = rp.permission;
        const existing = permissionMap.get(perm.name);

        if (existing) {
          // Add this role as an additional source
          existing.sourceRoles.push({ id: assignment.role.id, name: assignment.role.name });
        } else {
          permissionMap.set(perm.name, {
            id: perm.id,
            name: perm.name,
            module: perm.module,
            label: perm.label,
            sourceRoles: [{ id: assignment.role.id, name: assignment.role.name }],
          });
        }
      }
    }

    const permissions = Array.from(permissionMap.values()).sort((a, b) =>
      a.module.localeCompare(b.module) || a.label.localeCompare(b.label),
    );

    return {
      user,
      roles,
      permissions,
    };
  }


  async assertCanGrantPermissions(
    orgId: string,
    actorId: string | undefined,
    permissionNames: string[],
  ): Promise<void> {
    if (!actorId || permissionNames.length === 0) return;

    const actorPerms = new Set(await this.getUserPermissions(actorId, orgId));
    const denied = permissionNames.filter(
      (name) => NON_DELEGABLE_PERMISSIONS.has(name) || !actorPerms.has(name),
    );

    if (denied.length > 0) {
      throw new ForbiddenException(
        `You are not allowed to grant the following permission(s): ${denied.join(', ')}`,
      );
    }
  }

  async ensureNotLastOwnerWithRole(orgId: string, userId: string, targetRoleIds: string[]): Promise<void> {
    const ownerRole = await this.prisma.role.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: 'Owner' } },
    });

    if (!ownerRole) return;

    const currentlyHasOwner = await this.prisma.userRoleAssignment.findUnique({
      where: { userId_roleId: { userId, roleId: ownerRole.id } },
    });

    if (!currentlyHasOwner) return;

    const willRetainOwner = targetRoleIds.includes(ownerRole.id);
    if (willRetainOwner) return;

    const ownerCount = await this.prisma.userRoleAssignment.count({
      where: {
        roleId: ownerRole.id,
        user: { deletedAt: null, isActive: true },
      },
    });

    if (ownerCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the Owner role from the last Owner. Assign another user to the Owner role first.',
      );
    }
  }
}
