import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ConfigModule } from '../config/config.module';
import { CoreModule } from '../core/core.module';
import { WorkspaceAccessEnforcer } from '../core/workspace-access-enforcer';
import { WorkspaceAccessPolicy } from '../core/workspace-access-policy';
import { BUILTIN_MODULE_MANIFESTS } from '../core/module-manifests';
import { ModuleRegistry } from '../core/module-registry';
import { RbacWorkspacePermissions } from '../core/rbac-workspace-permissions';
import { WorkspaceContextAdapter } from '../core/workspace-context.adapter';
import { WorkspacePermissionMapper } from '../core/workspace-permission.mapper';
import { WorkspaceResolver } from '../core/workspace-resolver';
import { WorkspaceRuntimeService } from '../core/workspace-runtime.service';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { WorkspaceRuntimeAccessService } from '../rbac/workspace-runtime-access.service';

import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { ActivityService } from './activity.service';
import { CrmModule } from './crm.module';

function makeUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    id: 'user-1',
    email: 'member@acme.com',
    role: 'MANAGER',
    organizationId: 'org-1',
    ...overrides,
  };
}

function buildRuntime(): WorkspaceRuntimeService {
  const registry = new ModuleRegistry();
  for (const manifest of BUILTIN_MODULE_MANIFESTS) {
    registry.register(manifest);
  }
  return new WorkspaceRuntimeService(
    new WorkspaceContextAdapter(),
    new WorkspaceResolver(),
    registry,
  );
}

function buildController(getter: (orgId: string, userId: string) => Promise<string[]>) {
  const runtime = buildRuntime();
  const registry = new ModuleRegistry();
  for (const manifest of BUILTIN_MODULE_MANIFESTS) {
    registry.register(manifest);
  }
  const rbacPermissions = {
    resolveForUser: jest.fn((orgId: string, userId: string) => getter(orgId, userId)),
  } as unknown as RbacWorkspacePermissions;

  const workspaceAccess = new WorkspaceRuntimeAccessService(
    rbacPermissions,
    runtime,
    new WorkspacePermissionMapper(),
    registry,
  );
  const enforcer = new WorkspaceAccessEnforcer(new WorkspaceAccessPolicy());

  const findAll = jest.fn(async (orgId: string) => ({ orgId, data: [] }));
  const leadService = { findAll } as unknown as LeadService;
  const activityService = {} as unknown as ActivityService;

  const controller = new LeadController(
    leadService,
    activityService,
    workspaceAccess,
    enforcer,
  );

  return { controller, findAll, rbacResolve: rbacPermissions.resolveForUser as jest.Mock };
}

describe('LeadController (Phase 1F.3 additive Business OS enforcement pilot)', () => {
  it('allows an authenticated RBAC-authorized user with crm.read to reach the endpoint', async () => {
    const { controller, findAll } = buildController(async () => ['crm.read']);
    const query = { page: 1, limit: 10 } as never;

    const result = await controller.findAll(makeUser(), query);

    expect(findAll).toHaveBeenCalledWith('org-1', query);
    expect(result).toEqual({ orgId: 'org-1', data: [] });
  });

  it('denies when the crm.read permission is absent from effective RBAC', async () => {
    const { controller, findAll, rbacResolve } = buildController(async () => []);
    const query = {} as never;

    // With no effective RBAC permission, the mapper yields no crm module, so
    // the additive Business OS check throws ForbiddenException (and the RBAC
    // PermissionGuard would have denied at the HTTP layer already).
    await expect(controller.findAll(makeUser(), query)).rejects.toThrow(
      ForbiddenException,
    );
    expect(findAll).not.toHaveBeenCalled();
    expect(rbacResolve).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('cannot be expanded by injecting permissions/modules via caller options', async () => {
    const { controller, findAll } = buildController(async () => ['billing.read']);
    const query = {} as never;

    // The controller only forwards the authenticated user; no caller-supplied
    // permissions/modules exist. billing.read does not unlock the crm module,
    // so the Business OS check denies even if the HTTP layer were bypassed.
    await expect(controller.findAll(makeUser(), query)).rejects.toThrow(
      ForbiddenException,
    );
    expect(findAll).not.toHaveBeenCalled();
  });

  it('denies a workspace without authoritative CRM module access via the enforcer', async () => {
    const { controller, findAll } = buildController(async () => ['inventory.read']);
    const query = {} as never;

    await expect(controller.findAll(makeUser(), query)).rejects.toThrow(
      ForbiddenException,
    );
    expect(findAll).not.toHaveBeenCalled();
  });

  it('derives tenant context only from the authenticated user.organizationId', async () => {
    const { controller, findAll } = buildController(async () => ['crm.read']);

    await controller.findAll(makeUser({ organizationId: 'org-7' }), {} as never);

    expect(findAll).toHaveBeenCalledWith('org-7', expect.anything());
  });

  it('rejects a user without an organization using the tenant-context error style', async () => {
    const { controller, findAll } = buildController(async () => ['crm.read']);

    await expect(controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      'User does not belong to an organization',
    );
    expect(findAll).not.toHaveBeenCalled();
  });

  it('keeps ADMIN->manager and USER->employee canonical role mappings working', async () => {
    const { controller, findAll } = buildController(async () => ['crm.read']);

    await controller.findAll(makeUser({ role: 'ADMIN' }), {} as never);
    await controller.findAll(makeUser({ role: 'USER' }), {} as never);

    expect(findAll).toHaveBeenCalledTimes(2);
  });

  it('uses no role-name based module rule (ADMIN/USER access follows RBAC permissions only)', async () => {
    const { controller, findAll } = buildController(async () => []);
    const query = {} as never;

    // ADMIN or USER without crm.read is still denied; role names never grant.
    await expect(controller.findAll(makeUser({ role: 'ADMIN' }), query)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.findAll(makeUser({ role: 'USER' }), query)).rejects.toThrow(
      ForbiddenException,
    );
    expect(findAll).not.toHaveBeenCalled();
  });

  it('leaves the existing business service behavior untouched', async () => {
    const { controller, findAll } = buildController(async () => ['crm.read']);
    const query = { page: 2, limit: 5 } as never;

    const result = await controller.findAll(makeUser(), query);

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(findAll).toHaveBeenCalledWith('org-1', query);
    expect(result).toEqual({ orgId: 'org-1', data: [] });
  });

  it('preserves the JwtAuthGuard / PermissionGuard / requireOrg contract', () => {
    const guards = Reflect.getMetadata('__guards__', LeadController);
    expect(guards).toBeDefined();
    // Class-level JwtAuthGuard is still applied.
    const classGuardNames = guards.map((g: () => unknown) => g.name);
    expect(classGuardNames).toContain('JwtAuthGuard');

    // The route-level PermissionGuard + @Permissions(['crm.read']) survive.
    const descriptor = Object.getOwnPropertyDescriptor(LeadController.prototype, 'findAll');
    const handler = descriptor?.value;
    expect(handler).toBeDefined();
    const handlerGuards = Reflect.getMetadata('__guards__', handler);
    expect(handlerGuards.map((g: () => unknown) => g.name)).toContain('PermissionGuard');
    const permissions = Reflect.getMetadata('permissions', handler);
    expect(permissions).toMatchObject({ permissions: ['crm.read'] });
  });
});

describe('LeadController (Nest DI wiring)', () => {
  it('resolves the controller through DI with no manual instantiation of Business OS services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule, CrmModule],
    }).compile();

    const controller = moduleRef.get(LeadController);
    expect(controller).toBeInstanceOf(LeadController);
  });
});
