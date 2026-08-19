import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { RbacService } from './rbac.service';
import { PrismaService } from '../prisma/prisma.service';


describe('RbacService audit + isolation security', () => {
  let service: RbacService;
  const mocks: Record<string, jest.Mock> = {};
  let auditCreate: jest.Mock;

  const auditLog = (): { action: string; organizationId: string } | undefined => {
    const data = auditCreate.mock.calls[0]?.[0]?.data as
      | { action: string; organizationId: string }
      | undefined;
    return data;
  };

  beforeEach(() => {
    for (const key of Object.keys(mocks)) mocks[key].mockReset();
    auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });

    service = new RbacService({
      auditLog: { create: auditCreate },
      permission: { findMany: jest.fn() },
      rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService);
  });

  describe('createRole', () => {
    it('rejects a duplicate role name within the same organization', async () => {
      (service as unknown as {
        prisma: { role: { findUnique: jest.Mock } };
      }).prisma.role = { findUnique: jest.fn().mockResolvedValue({ id: 'dup' }) };

      await expect(
        service.createRole('org-1', { name: 'Manager' }),
      ).rejects.toThrow(ConflictException);
    });

    it('records a ROLE.CREATE audit entry with actor and organization', async () => {
      (service as unknown as { prisma: { role: { findUnique: jest.Mock; create: jest.Mock } } }).prisma.role = {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'role-new', name: 'Manager', description: null, isSystem: false,
          organizationId: 'org-1', createdAt: new Date(), updatedAt: new Date(),
        }),
      };

      await service.createRole('org-1', { name: 'Manager' }, 'actor-1');

      expect(auditCreate).toHaveBeenCalledTimes(1);
      expect(auditLog()).toMatchObject({
        action: 'ROLE.CREATE',
        organizationId: 'org-1',
      });
      expect(auditCreate.mock.calls[0][0].data.userId).toBe('actor-1');
      expect(auditCreate.mock.calls[0][0].data.entity).toBe('role');
      expect(auditCreate.mock.calls[0][0].data.entityId).toBe('role-new');
    });
  });

  describe('updateRole', () => {
    it('records a ROLE.UPDATE audit entry', async () => {
      (service as unknown as { prisma: { role: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock } } }).prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-1', isSystem: false, name: 'Old' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'role-1', name: 'New', isSystem: false }),
      };

      await service.updateRole('org-1', 'role-1', { name: 'New' }, 'actor-1');

      expect(auditLog()).toMatchObject({ action: 'ROLE.UPDATE', entityId: 'role-1' });
    });
  });

  describe('deleteRole', () => {
    it('rejects deleting a protected/system role', async () => {
      (service as unknown as { prisma: { role: { findFirst: jest.Mock; delete: jest.Mock } } }).prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-admin', isSystem: true, name: 'Admin' }),
        delete: jest.fn(),
      };

      await expect(service.deleteRole('org-1', 'role-admin')).rejects.toThrow();
      expect((service as unknown as { prisma: { role: { delete: jest.Mock } } }).prisma.role.delete).not.toHaveBeenCalled();
    });

    it('records a ROLE.DELETE audit entry for a custom role', async () => {
      (service as unknown as { prisma: { role: { findFirst: jest.Mock; delete: jest.Mock } } }).prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-custom', isSystem: false, name: 'Temp' }),
        delete: jest.fn().mockResolvedValue({}),
      };
      (service as unknown as { prisma: { userRoleAssignment: { count: jest.Mock } } }).prisma.userRoleAssignment = {
        count: jest.fn().mockResolvedValue(0),
      };

      await service.deleteRole('org-1', 'role-custom', 'actor-1');

      expect(auditLog()).toMatchObject({ action: 'ROLE.DELETE', entityId: 'role-custom' });
      expect(auditCreate.mock.calls[0][0].data.metadata).toMatchObject({ name: 'Temp' });
    });

    it('rejects deleting a role that is still assigned to users', async () => {
      (service as unknown as { prisma: { role: { findFirst: jest.Mock; delete: jest.Mock } } }).prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-custom', isSystem: false, name: 'Temp' }),
        delete: jest.fn(),
      };
      (service as unknown as { prisma: { userRoleAssignment: { count: jest.Mock } } }).prisma.userRoleAssignment = {
        count: jest.fn().mockResolvedValue(3),
      };

      await expect(service.deleteRole('org-1', 'role-custom')).rejects.toThrow(BadRequestException);
      expect((service as unknown as { prisma: { role: { delete: jest.Mock } } }).prisma.role.delete).not.toHaveBeenCalled();
    });
  });

  describe('assignPermissions', () => {
    it('rejects invalid/unknown permission keys', async () => {
      (service as unknown as { prisma: { role: { findFirst: jest.Mock } } }).prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-1', isSystem: false, name: 'Custom' }),
      };
      (service as unknown as { prisma: { permission: { findMany: jest.Mock } } }).prisma.permission.findMany =
        jest.fn().mockResolvedValue([{ id: 'p1', name: 'users.read' }]);

     
      await expect(
        service.assignPermissions('org-1', 'role-1', {
          permissionNames: ['users.read', 'inventory.create'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('records a ROLE.PERMISSIONS.UPDATE audit entry with granted/removed diff', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> }).prisma;
      prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-1', isSystem: false, name: 'Custom' }),
      };
      prisma.permission = {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p-read', name: 'users.read' },
          { id: 'p-create', name: 'users.create' },
        ]),
      };
      prisma.rolePermission = {
        findMany: jest.fn().mockResolvedValue([{ permissionId: 'p-read' }]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      };
      (prisma as Record<string, jest.Mock>).$transaction = jest.fn(
        async (cb: (tx: unknown) => Promise<unknown>) => cb({
          rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
        }),
      );
      // Actor holds the requested permissions, so delegation is allowed.
      (service.getUserPermissions as unknown) = jest.fn().mockResolvedValue([
        'users.read',
        'users.create',
      ]);

      await service.assignPermissions('org-1', 'role-1',
        { permissionNames: ['users.read', 'users.create'] }, 'actor-1');

      expect(auditLog()).toMatchObject({ action: 'ROLE.PERMISSIONS.UPDATE', entityId: 'role-1' });
      const metadata = auditCreate.mock.calls[0][0].data.metadata;
      expect(metadata.permissionsGranted).toEqual(['users.create']);
      expect(metadata.permissionIdsRemoved).toEqual([]);
    });

    it('rejects granting a permission the actor does not hold (delegation)', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> }).prisma;
      prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-1', isSystem: false, name: 'Custom' }),
      };
      prisma.permission = {
        findMany: jest.fn().mockResolvedValue([{ id: 'p', name: 'organization.manage' }]),
      };
      (service.getUserPermissions as unknown) = jest.fn().mockResolvedValue([
        'customers.read',
      ]);

      await expect(
        service.assignPermissions('org-1', 'role-1',
          { permissionNames: ['organization.manage'] }, 'actor-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(auditCreate).not.toHaveBeenCalled();
    });

    it('blocks granting non-delegable organization.manage even if actor holds it', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> }).prisma;
      prisma.role = {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-1', isSystem: false, name: 'Custom' }),
      };
      prisma.permission = {
        findMany: jest.fn().mockResolvedValue([{ id: 'p', name: 'organization.manage' }]),
      };
      (service.getUserPermissions as unknown) = jest.fn().mockResolvedValue([
        'organization.manage',
      ]);

      await expect(
        service.assignPermissions('org-1', 'role-1',
          { permissionNames: ['organization.manage'] }, 'actor-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignUserRoles (cross-tenant isolation)', () => {
    it('rejects assigning a role to a user outside the organization', async () => {
      (service as unknown as { prisma: { user: { findFirst: jest.Mock }; role: { findMany: jest.Mock } } }).prisma.user = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.assignUserRoles('org-1', 'user-from-org-2', { roleIds: ['role-a'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when a selected role belongs to another organization', async () => {
      (service as unknown as { prisma: { user: { findFirst: jest.Mock } } }).prisma.user = {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      };
      (service as unknown as { prisma: { role: { findMany: jest.Mock } } }).prisma.role = {
        // only 1 of 2 requested roles resolved -> mismatch -> reject
        findMany: jest.fn().mockResolvedValue([{ id: 'role-own' }]),
      };

      await expect(
        service.assignUserRoles('org-1', 'user-1', {
          roleIds: ['role-own', 'role-org-2'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('records a ROLE.ASSIGN audit entry for a valid in-org assignment', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> }).prisma;
      prisma.user = { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) };
      prisma.role = {
        findMany: jest.fn().mockResolvedValue([{ id: 'role-a', name: 'Manager' }]),
        findUnique: jest.fn().mockResolvedValue(null),
      };
      prisma.userRoleAssignment = {
        findUnique: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      };
      (prisma as Record<string, jest.Mock>).$transaction = jest.fn(
        async (cb: (tx: unknown) => Promise<unknown>) => cb({
          userRoleAssignment: { deleteMany: jest.fn(), createMany: jest.fn() },
        }),
      );

      await service.assignUserRoles('org-1', 'user-1', { roleIds: ['role-a'] }, 'actor-1');

      expect(auditLog()).toMatchObject({ action: 'ROLE.ASSIGN', entityId: 'user-1' });
      expect(auditCreate.mock.calls[0][0].data.metadata).toMatchObject({
        roleIds: ['role-a'],
        roleNames: ['Manager'],
      });
    });
  });
});