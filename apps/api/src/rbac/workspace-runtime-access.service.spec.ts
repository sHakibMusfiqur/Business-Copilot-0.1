import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { BUILTIN_MODULE_MANIFESTS } from '../core/module-manifests';
import { ModuleRegistry } from '../core/module-registry';
import { RbacWorkspacePermissions } from '../core/rbac-workspace-permissions';
import { WorkspaceContextAdapter } from '../core/workspace-context.adapter';
import { WorkspacePermissionMapper } from '../core/workspace-permission.mapper';
import { WorkspaceResolver } from '../core/workspace-resolver';
import { WorkspaceRuntimeService } from '../core/workspace-runtime.service';

import { WorkspaceRuntimeAccessService } from './workspace-runtime-access.service';

type PermissionGetter = (orgId: string, userId: string) => Promise<string[]>;

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

function buildService(getter: PermissionGetter) {
  const runtime = buildRuntime();
  const registry = new ModuleRegistry();
  for (const manifest of BUILTIN_MODULE_MANIFESTS) {
    registry.register(manifest);
  }
  const rbacPermissions = {
    resolveForUser: jest.fn((orgId: string, userId: string) => getter(orgId, userId)),
  } as unknown as RbacWorkspacePermissions;
  const spyRuntimeResolve = jest.spyOn(runtime, 'resolve');

  const service = new WorkspaceRuntimeAccessService(
    rbacPermissions,
    runtime,
    new WorkspacePermissionMapper(),
    registry,
  );

  return {
    service,
    rbacResolve: rbacPermissions.resolveForUser as jest.Mock,
    spyRuntimeResolve,
  };
}

describe('WorkspaceRuntimeAccessService (async RBAC-aware runtime facade)', () => {
  it('feeds RBAC-derived permissions into the pure runtime pipeline', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const resolved = await service.resolveForUser(makeUser(), {
      modules: ['crm', 'billing'],
    });

    expect(resolved.permissions).toEqual(['crm.read']);
    // both modules are in the entitlement allow-list, but only crm has the
    // required permission — billing stays gated by RBAC
    expect(resolved.enabledModuleIds).toEqual(['crm']);
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('administration')).toBe(false);
  });

  it('resolves permissions for the authenticated organization and user', async () => {
    const { service, rbacResolve } = buildService(async () => ['crm.read']);
    await service.resolveForUser(makeUser());

    expect(rbacResolve).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('rejects a user with no organization before touching RBAC or the runtime', async () => {
    const { service, rbacResolve, spyRuntimeResolve } = buildService(
      async () => ['crm.read'],
    );
    const user = makeUser({ organizationId: undefined });

    await expect(service.resolveForUser(user)).rejects.toThrow(ForbiddenException);
    await expect(service.resolveForUser(user)).rejects.toThrow(
      'User does not belong to an organization',
    );
    expect(rbacResolve).not.toHaveBeenCalled();
    expect(spyRuntimeResolve).not.toHaveBeenCalled();
  });

  it('ignores caller-supplied permissions — RBAC is authoritative', async () => {
    const { service, rbacResolve } = buildService(async () => ['crm.read']);
    const resolved = await service.resolveForUser(makeUser(), {
      permissions: ['billing.read'],
      modules: ['crm', 'billing'],
    });

    expect(rbacResolve).toHaveBeenCalledWith('org-1', 'user-1');
    expect(resolved.permissions).toEqual(['crm.read']);
    expect(resolved.permissions).not.toContain('billing.read');
    expect(resolved.enabledModuleIds).toEqual(['crm']);
    expect(resolved.capabilities.can('administration')).toBe(false);
    expect(resolved.capabilities.can('platform')).toBe(false);
  });

  it('constrains even a broader caller-provided permission set', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const resolved = await service.resolveForUser(makeUser(), {
      permissions: ['crm.read', 'billing.read', 'inventory.read'],
      modules: ['crm', 'billing', 'inventory'],
    });

    expect(resolved.permissions).toEqual(['crm.read']);
    expect(resolved.enabledModuleIds).toEqual(['crm']);
  });

  it('preserves non-permission runtime options', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const resolved = await service.resolveForUser(makeUser(), {
      organizationName: 'Acme',
      modules: ['crm'],
      plan: 'growth',
      aiEnabled: false,
    });

    expect(resolved.tenant.organizationName).toBe('Acme');
    expect(resolved.entitlement.source).toBe('plan');
    expect(resolved.entitlement.key).toBe('growth');
    expect(resolved.aiEnabled).toBe(false);
    expect(resolved.enabledModuleIds).toEqual(['crm']);
  });

  it('does not mutate the authenticated user object', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const user = makeUser();
    const snapshot = JSON.stringify(user);

    await service.resolveForUser(user);

    expect(JSON.stringify(user)).toBe(snapshot);
  });

  it('queries current RBAC state on every call (no cache, immediate effect)', async () => {
    let permissions: string[] = ['crm.read'];
    const { service, rbacResolve } = buildService(async () => permissions);

    const before = await service.resolveForUser(makeUser(), {
      modules: ['crm'],
    });
    expect(before.enabledModuleIds).toEqual(['crm']);

    permissions = [];
    const after = await service.resolveForUser(makeUser(), {
      modules: ['crm'],
    });
    expect(after.enabledModuleIds).toEqual([]);
    expect(after.capabilities.can('crm')).toBe(false);

    expect(rbacResolve).toHaveBeenCalledTimes(2);
  });

  it('is deterministic and returns a fresh result on every call', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const user = makeUser();

    const first = await service.resolveForUser(user);
    const second = await service.resolveForUser(user);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).not.toBe(second);
  });

  it('resolves an empty permission set to dashboard-only access', async () => {
    const { service } = buildService(async () => []);
    const resolved = await service.resolveForUser(makeUser());

    expect(resolved.permissions).toEqual([]);
    expect(resolved.enabledModuleIds).toEqual([]);
    expect(resolved.capabilities.granted).toEqual(['dashboard']);
  });

  it('works with no options argument — RBAC-permitted modules now resolve', async () => {
    const { service } = buildService(async () => ['billing.read']);
    const resolved = await service.resolveForUser(makeUser());

    expect(resolved.permissions).toEqual(['billing.read']);
    // The authoritative module set is derived from RBAC permissions, so billing
    // resolves without the caller having to enumerate it.
    expect(resolved.enabledModuleIds).toEqual(['billing']);
  });

  it('caller-provided modules cannot expand access beyond RBAC', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const resolved = await service.resolveForUser(makeUser(), {
      modules: ['crm', 'billing'],
    });

    // billing is listed but the user lacks billing.read -> still disabled
    expect(resolved.enabledModuleIds).toEqual(['crm']);
  });

  it('maps crm.read to a resolvable crm module without caller modules', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const resolved = await service.resolveForUser(makeUser());

    expect(resolved.enabledModuleIds).toEqual(['crm']);
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('administration')).toBe(false);
  });

  it('maps billing.read to a resolvable billing module without caller modules', async () => {
    const { service } = buildService(async () => ['billing.read']);
    const resolved = await service.resolveForUser(makeUser());

    expect(resolved.enabledModuleIds).toEqual(['billing']);
    expect(resolved.capabilities.can('administration')).toBe(true);
    expect(resolved.capabilities.can('platform')).toBe(true);
    expect(resolved.capabilities.can('crm')).toBe(false);
  });

  it('maps both permissions to both resolvable modules without caller modules', async () => {
    const { service } = buildService(async () => ['crm.read', 'inventory.read']);
    const resolved = await service.resolveForUser(makeUser());

    // inventory has no built-in manifest, so only crm is a registered module.
    expect(resolved.enabledModuleIds).toEqual(['crm']);
  });

  it('maps both built-in permissions to both resolvable modules', async () => {
    const { service } = buildService(async () => ['crm.read', 'billing.read']);
    const resolved = await service.resolveForUser(makeUser());

    expect(resolved.enabledModuleIds).toEqual(['billing', 'crm']);
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('administration')).toBe(true);
  });

  it('empty RBAC permissions resolves no business modules', async () => {
    const { service } = buildService(async () => []);
    const resolved = await service.resolveForUser(makeUser());

    expect(resolved.permissions).toEqual([]);
    expect(resolved.enabledModuleIds).toEqual([]);
    expect(resolved.capabilities.granted).toEqual(['dashboard']);
  });

  it('caller-supplied modules can only restrict, never expand, authoritative modules', async () => {
    const { service } = buildService(async () => ['crm.read', 'billing.read']);
    // Caller restricts to crm even though authoritative RBAC also permits billing.
    const resolved = await service.resolveForUser(makeUser(), {
      modules: ['crm'],
    });

    expect(resolved.enabledModuleIds).toEqual(['crm']);
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('administration')).toBe(false);
  });

  it('caller-supplied modules cannot grant a module absent from authoritative RBAC', async () => {
    const { service } = buildService(async () => ['crm.read']);
    // billing.read is not among effective RBAC permissions; caller enumerating it
    // in options.modules must still not make billing resolve.
    const resolved = await service.resolveForUser(makeUser(), {
      modules: ['crm', 'billing'],
    });

    expect(resolved.enabledModuleIds).toEqual(['crm']);
  });

  it('continues to support ADMIN/USER canonical role mapping', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const admin = await service.resolveForUser(makeUser({ role: 'ADMIN' }));
    const user = await service.resolveForUser(makeUser({ role: 'USER' }));

    expect(admin.role).toBe('manager');
    expect(admin.enabledModuleIds).toEqual(['crm']);
    expect(user.role).toBe('employee');
    expect(user.enabledModuleIds).toEqual(['crm']);
  });

  it('keeps tenant ID sourced only from the authenticated user.organizationId', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const resolved = await service.resolveForUser(makeUser());

    expect(resolved.tenant.tenantId).toBe('org-1');
  });

  it('does not mutate caller options or the authenticated user', async () => {
    const { service } = buildService(async () => ['crm.read']);
    const user = makeUser();
    const userSnapshot = JSON.stringify(user);
    const options = { modules: ['crm', 'billing'] };
    const optionsSnapshot = JSON.stringify(options);

    await service.resolveForUser(user, options);

    expect(JSON.stringify(user)).toBe(userSnapshot);
    expect(JSON.stringify(options)).toBe(optionsSnapshot);
  });

  it('propagates an RBAC bridge rejection without invoking the runtime', async () => {
    const { service, spyRuntimeResolve } = buildService(async () => {
      throw new NotFoundException('User not found in this organization');
    });

    await expect(service.resolveForUser(makeUser())).rejects.toThrow(
      NotFoundException,
    );
    expect(spyRuntimeResolve).not.toHaveBeenCalled();
  });
});