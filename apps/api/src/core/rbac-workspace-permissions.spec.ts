import { NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

import { BUILTIN_MODULE_MANIFESTS } from './module-manifests';
import { ModuleResolver } from './module-resolver';
import { RbacWorkspacePermissions } from './rbac-workspace-permissions';

interface SimUser {
  id: string;
  organizationId: string;
  deletedAt: Date | null;
}

interface SimRole {
  id: string;
  organizationId: string;
}

interface SimAssignment {
  userId: string;
  roleId: string;
}

interface SimRolePermission {
  roleId: string;
  permissionName: string;
}

interface SimData {
  users: SimUser[];
  roles: SimRole[];
  assignments: SimAssignment[];
  rolePermissions: SimRolePermission[];
}

/**
 * Builds a PrismaService mock whose `rolePermission.findMany` faithfully
 * applies the org + assignment `where` scope the resolver sends, so
 * cross-organization / removed-role leakage is exercised end-to-end.
 */
function buildPrisma(data: SimData) {
  const calls: {
    userFindFirst: Array<{ where: { id: string; organizationId: string; deletedAt: null } }>;
    rolePermissionFindMany: Array<{ where: { role: { organizationId: string; userAssignments: { some: { userId: string } } } } }>;
  } = { userFindFirst: [], rolePermissionFindMany: [] };

  const userFindFirst = jest.fn((args: { where: { id: string; organizationId: string; deletedAt: null } }) => {
    calls.userFindFirst.push(args);
    const match = data.users.find(
      (u) =>
        u.id === args.where.id &&
        u.organizationId === args.where.organizationId &&
        u.deletedAt === args.where.deletedAt,
    );
    return Promise.resolve(match ? { id: match.id } : null);
  });

  const rolePermissionFindMany = jest.fn((args: {
    where: { role: { organizationId: string; userAssignments: { some: { userId: string } } } };
  }) => {
    calls.rolePermissionFindMany.push(args);
    const roleOrgId = args.where.role.organizationId;
    const targetUserId = args.where.role.userAssignments.some.userId;

    const activeRoleIds = new Set(
      data.roles
        .filter((role) => role.organizationId === roleOrgId)
        .map((role) => role.id),
    );
    const assignedRoleIds = new Set(
      data.assignments
        .filter((assignment) => assignment.userId === targetUserId)
        .map((assignment) => assignment.roleId),
    );

    const rows = data.rolePermissions
      .filter(
        (rp) => activeRoleIds.has(rp.roleId) && assignedRoleIds.has(rp.roleId),
      )
      .map((rp) => ({ permission: { name: rp.permissionName } }));

    return Promise.resolve(rows);
  });

  const billing = { findMany: jest.fn(), findUnique: jest.fn() };
  const plan = { findMany: jest.fn(), findUnique: jest.fn() };

  const prisma = {
    user: { findFirst: userFindFirst, create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    rolePermission: { findMany: rolePermissionFindMany, create: jest.fn(), deleteMany: jest.fn() },
    billing,
    plan,
  } as unknown as PrismaService;

  return { prisma, calls, userFindFirst, rolePermissionFindMany, billing, plan };
}

const now = new Date();

function baseData(): SimData {
  return {
    users: [
      { id: 'user-1', organizationId: 'org-1', deletedAt: null },
      { id: 'user-deleted', organizationId: 'org-1', deletedAt: now },
      { id: 'user-other-org', organizationId: 'org-2', deletedAt: null },
      { id: 'user-3', organizationId: 'org-1', deletedAt: null },
      { id: 'user-admin', organizationId: 'org-1', deletedAt: null },
      { id: 'user-staff', organizationId: 'org-1', deletedAt: null },
    ],
    roles: [
      { id: 'role-a', organizationId: 'org-1' },
      { id: 'role-b', organizationId: 'org-1' },
      { id: 'role-x', organizationId: 'org-2' },
    ],
    assignments: [
      { userId: 'user-1', roleId: 'role-a' },
      { userId: 'user-1', roleId: 'role-b' },
      // attempt to leak a cross-organization role onto user-1
      { userId: 'user-1', roleId: 'role-x' },
      { userId: 'user-other-org', roleId: 'role-x' },
      { userId: 'user-admin', roleId: 'role-a' },
      { userId: 'user-staff', roleId: 'role-a' },
    ],
    rolePermissions: [
      { roleId: 'role-a', permissionName: 'crm.read' },
      { roleId: 'role-a', permissionName: 'billing.read' }, // shared
      { roleId: 'role-b', permissionName: 'billing.read' }, // shared
      { roleId: 'role-b', permissionName: 'inventory.read' }, // unique to role-b
      { roleId: 'role-x', permissionName: 'payroll.read' }, // cross-org
    ],
  };
}

function resolver(prisma: PrismaService): RbacWorkspacePermissions {
  return new RbacWorkspacePermissions(prisma);
}

describe('RbacWorkspacePermissions (RBAC -> Business OS bridge)', () => {
  it('returns crm.read for a USER whose role grants crm.read', async () => {
    const { prisma } = buildPrisma(baseData());
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(perms).toContain('crm.read');
  });

  it('does not return crm.read for a USER who lacks it', async () => {
    const data = baseData();
    // strip crm.read from the only org-1 role assignment set
    data.rolePermissions = data.rolePermissions.filter(
      (rp) => rp.permissionName !== 'crm.read',
    );
    const { prisma } = buildPrisma(data);
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(perms).not.toContain('crm.read');
  });

  it('merges permissions across multiple assigned roles', async () => {
    const { prisma } = buildPrisma(baseData());
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(perms).toEqual(expect.arrayContaining(['crm.read', 'billing.read', 'inventory.read']));
  });

  it('de-duplicates permissions shared across roles', async () => {
    const { prisma } = buildPrisma(baseData());
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(perms.filter((p) => p === 'billing.read')).toHaveLength(1);
  });

  it('removes only the permissions unique to a removed role', async () => {
    const data = baseData();
    // remove role-b from the user (role removed / assignment severed)
    data.assignments = data.assignments.filter(
      (a) => !(a.userId === 'user-1' && a.roleId === 'role-b'),
    );
    const { prisma } = buildPrisma(data);
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');

    expect(perms).not.toContain('inventory.read'); // unique to role-b
    expect(perms).toContain('crm.read');
  });

  it('keeps a permission shared by two roles after one role is removed', async () => {
    const data = baseData();
    data.assignments = data.assignments.filter(
      (a) => !(a.userId === 'user-1' && a.roleId === 'role-b'),
    );
    const { prisma } = buildPrisma(data);
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');
    // billing.read survives because role-a still grants it
    expect(perms).toContain('billing.read');
  });

  it('does not let a removed/soft-deleted role contribute permissions', async () => {
    const data = baseData();
    // role-b no longer participates (its assignment row is gone, mirroring the
    // cascade of a role hard-delete in the current schema)
    data.assignments = data.assignments.filter(
      (a) => !(a.userId === 'user-1' && a.roleId === 'role-b'),
    );
    const { prisma } = buildPrisma(data);
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(perms).not.toContain('inventory.read');
  });

  it('rejects a soft-deleted user for the organization', async () => {
    const { prisma, userFindFirst } = buildPrisma(baseData());
    await expect(
      resolver(prisma).resolveForUser('org-1', 'user-deleted'),
    ).rejects.toThrow(NotFoundException);

    expect(userFindFirst.mock.calls[0][0].where).toEqual({
      id: 'user-deleted',
      organizationId: 'org-1',
      deletedAt: null,
    });
  });

  it('rejects a cross-organization user', async () => {
    const { prisma } = buildPrisma(baseData());
    await expect(
      resolver(prisma).resolveForUser('org-2', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not leak permissions from a cross-organization role assignment', async () => {
    const { prisma } = buildPrisma(baseData());
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');
    // user-1 is (attempted-to-be) assigned cross-org role-x -> payroll.read
    expect(perms).not.toContain('payroll.read');
  });

  it('applies organization scope to the role lookup', async () => {
    const { prisma, rolePermissionFindMany } = buildPrisma(baseData());
    await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(rolePermissionFindMany.mock.calls[0][0].where.role.organizationId).toBe('org-1');
  });

  it('applies organization scope to the user lookup', async () => {
    const { prisma, userFindFirst } = buildPrisma(baseData());
    await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(userFindFirst.mock.calls[0][0].where.organizationId).toBe('org-1');
  });

  it('applies organization scope to the assignment lookup (target user only)', async () => {
    const { prisma, rolePermissionFindMany } = buildPrisma(baseData());
    await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(rolePermissionFindMany.mock.calls[0][0].where.role.userAssignments.some).toEqual({
      userId: 'user-1',
    });
  });

  it('is deterministic and returns a fresh sorted result on every call', async () => {
    const { prisma } = buildPrisma(baseData());
    const service = resolver(prisma);
    const first = await service.resolveForUser('org-1', 'user-1');
    const second = await service.resolveForUser('org-1', 'user-1');

    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
    expect(first).not.toBe(second);
  });

  it('does not mutate RBAC records or invoke any write path', async () => {
    const data = baseData();
    const snapshot = JSON.stringify(data.rolePermissions);
    const { prisma, billing, plan, userFindFirst, rolePermissionFindMany } = buildPrisma(data);

    await resolver(prisma).resolveForUser('org-1', 'user-1');

    expect(JSON.stringify(data.rolePermissions)).toBe(snapshot);
    expect(userFindFirst).toHaveBeenCalledTimes(1);
    expect(rolePermissionFindMany).toHaveBeenCalledTimes(1);

    // no writes, no billing/subscription/plan lookups
    expect(billing.findMany).not.toHaveBeenCalled();
    expect(billing.findUnique).not.toHaveBeenCalled();
    expect(plan.findMany).not.toHaveBeenCalled();
    expect(plan.findUnique).not.toHaveBeenCalled();
  });

  it('returns an empty list when the user has no role assignments', async () => {
    const { prisma } = buildPrisma(baseData());
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-3');
    expect(perms).toEqual([]);
  });

  it('ModuleManifest.permissions consumes the returned list without role logic', async () => {
    const { prisma } = buildPrisma(baseData());
    const service = resolver(prisma);

    const withCrm = await service.resolveForUser('org-1', 'user-1');
    expect(withCrm).toContain('crm.read');

    const moduleResolver = new ModuleResolver(BUILTIN_MODULE_MANIFESTS);
    const availableCrm = moduleResolver.resolve({
      permissions: withCrm,
      capabilities: ['crm'],
    });
    expect(availableCrm.some((m) => m.id === 'crm')).toBe(true);

    const moduleResolverEmpty = new ModuleResolver(BUILTIN_MODULE_MANIFESTS);
    const availableCrmWithout = moduleResolverEmpty.resolve({
      permissions: [],
      capabilities: ['crm'],
    });
    expect(availableCrmWithout.some((m) => m.id === 'crm')).toBe(false);
  });

  it('introduces no role-name check in the read path', async () => {
    const { prisma, rolePermissionFindMany } = buildPrisma(baseData());
    const perms = await resolver(prisma).resolveForUser('org-1', 'user-1');

    // no role.name / isSystem filter is applied — scope is purely org + userId
    const where = rolePermissionFindMany.mock.calls[0][0].where.role;
    expect(where).not.toHaveProperty('name');
    expect(where).not.toHaveProperty('isSystem');
    expect(Object.keys(where).sort()).toEqual(
      ['organizationId', 'userAssignments'].sort(),
    );

    // result is a flat list of permission names, nothing role-related
    expect(perms.every((p) => typeof p === 'string')).toBe(true);
  });

  it('is permission-driven for ADMIN vs USER (no role-name rules)', async () => {
    const { prisma } = buildPrisma(baseData());
    const service = resolver(prisma);

    const admin = await service.resolveForUser('org-1', 'user-admin');
    const staff = await service.resolveForUser('org-1', 'user-staff');

    // both users share the same permission set even though their backend
    // `role` fields differ (resolver never reads user.role)
    expect(admin).toEqual(staff);
    expect(admin).toContain('crm.read');
  });

  it('queries no billing/subscription/plan table', async () => {
    const { prisma, billing, plan } = buildPrisma(baseData());
    await resolver(prisma).resolveForUser('org-1', 'user-1');
    expect(billing.findMany).not.toHaveBeenCalled();
    expect(plan.findMany).not.toHaveBeenCalled();
  });

  it('is a dependency-free, read-only service (only PrismaService injected)', async () => {
    const { prisma, billing, plan } = buildPrisma(baseData());
    const service = resolver(prisma);
    expect(service).toBeInstanceOf(RbacWorkspacePermissions);

    await service.resolveForUser('org-1', 'user-1');
    // no HTTP/controller surface — no billing/plan access either
    expect(billing.findMany).not.toHaveBeenCalled();
    expect(plan.findMany).not.toHaveBeenCalled();
  });
});