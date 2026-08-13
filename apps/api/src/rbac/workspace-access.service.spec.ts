import { ForbiddenException } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { BUILTIN_MODULE_MANIFESTS } from '../core/module-manifests';
import { ModuleRegistry } from '../core/module-registry';
import { WorkspaceContextAdapter } from '../core/workspace-context.adapter';
import { WorkspacePermissionMapper } from '../core/workspace-permission.mapper';
import { WorkspaceResolver } from '../core/workspace-resolver';
import { WorkspaceRuntimeService } from '../core/workspace-runtime.service';

import { RbacService } from './rbac.service';
import { WorkspaceAccessService } from './workspace-access.service';

function makeUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    id: 'user-1',
    email: 'member@acme.com',
    role: 'MANAGER',
    organizationId: 'org-1',
    ...overrides,
  };
}

function buildRuntime(): { registry: ModuleRegistry; runtime: WorkspaceRuntimeService } {
  const registry = new ModuleRegistry();
  for (const manifest of BUILTIN_MODULE_MANIFESTS) {
    registry.register(manifest);
  }
  const runtime = new WorkspaceRuntimeService(
    new WorkspaceContextAdapter(),
    new WorkspaceResolver(),
    registry,
  );
  return { registry, runtime };
}

function buildService(
  permissionsByOrg: Record<string, string[]>,
): { service: WorkspaceAccessService; rbac: { getUserPermissions: jest.Mock } } {
  const { registry, runtime } = buildRuntime();
  const rbac = {
    getUserPermissions: jest.fn((_userId: string, orgId: string) =>
      Promise.resolve(permissionsByOrg[orgId] ?? []),
    ),
  } as unknown as RbacService;

  const service = new WorkspaceAccessService(
    rbac,
    new WorkspacePermissionMapper(),
    runtime,
    registry,
  );
  return { service, rbac: { getUserPermissions: rbac.getUserPermissions as jest.Mock } };
}

describe('WorkspaceAccessService (permission-driven workspace resolution)', () => {
  it('enables CRM for a user whose roles grant crm.read', async () => {
    const { service } = buildService({ 'org-1': ['crm.read'] });
    const resolved = await service.resolveForUser(makeUser());
    expect(resolved.enabledModuleIds).toEqual(['crm']);
    expect(resolved.capabilities.can('crm')).toBe(true);
  });

  it('surfaces the effective permissions in the resolved workspace', async () => {
    const { service } = buildService({ 'org-1': ['crm.read'] });
    const resolved = await service.resolveForUser(makeUser());
    expect(resolved.permissions).toEqual(['crm.read']);
  });

  it('disables CRM as soon as the permission is removed (no restart)', async () => {
    let permissions = ['crm.read'];
    const { registry, runtime } = buildRuntime();
    const rbac = {
      getUserPermissions: jest.fn(() => Promise.resolve(permissions)),
    } as unknown as RbacService;
    const service = new WorkspaceAccessService(
      rbac,
      new WorkspacePermissionMapper(),
      runtime,
      registry,
    );

    expect((await service.resolveForUser(makeUser())).enabledModuleIds).toEqual(['crm']);

    permissions = [];
    const after = await service.resolveForUser(makeUser());
    expect(after.enabledModuleIds).toEqual([]);
    expect(after.capabilities.can('crm')).toBe(false);
  });

  it('enables Billing for a user granted billing.read', async () => {
    const { service } = buildService({ 'org-1': ['billing.read'] });
    const resolved = await service.resolveForUser(makeUser());
    expect(resolved.enabledModuleIds).toEqual(['billing']);
    expect(resolved.capabilities.can('administration')).toBe(true);
    expect(resolved.capabilities.can('platform')).toBe(true);
    expect(resolved.capabilities.can('crm')).toBe(false);
  });

  it('merges permissions across multiple assigned roles', async () => {
    const { service } = buildService({ 'org-1': ['crm.read', 'billing.read'] });
    const resolved = await service.resolveForUser(makeUser());
    expect(resolved.enabledModuleIds).toEqual(['billing', 'crm']);
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('platform')).toBe(true);
  });

  it('keeps tenant isolation: only the authenticated org is consulted', async () => {
    const { service, rbac } = buildService({
      'org-a': ['crm.read'],
      'org-b': ['billing.read'],
    });

    const inA = await service.resolveForUser(
      makeUser({ id: 'user-9', organizationId: 'org-a' }),
    );
    const inB = await service.resolveForUser(
      makeUser({ id: 'user-9', organizationId: 'org-b' }),
    );

    expect(inA.enabledModuleIds).toEqual(['crm']);
    expect(inB.enabledModuleIds).toEqual(['billing']);
    expect(rbac.getUserPermissions).toHaveBeenCalledWith('user-9', 'org-a');
    expect(rbac.getUserPermissions).toHaveBeenCalledWith('user-9', 'org-b');
  });

  it('never allows a cross-org permission set to leak', async () => {
    const { service } = buildService({
      'org-a': ['crm.read'],
      'org-b': ['billing.read'],
    });
    const resolved = await service.resolveForUser(
      makeUser({ organizationId: 'org-a' }),
    );
    expect(resolved.enabledModuleIds).toEqual(['crm']);
    expect(resolved.enabledModuleIds).not.toContain('billing');
  });

  it('rejects a user with no organization before consulting RBAC', async () => {
    const { service, rbac } = buildService({});
    const user = makeUser({ organizationId: undefined });

    await expect(service.resolveForUser(user)).rejects.toThrow(ForbiddenException);
    await expect(service.resolveForUser(user)).rejects.toThrow(
      'User does not belong to an organization',
    );
    expect(rbac.getUserPermissions).not.toHaveBeenCalled();
  });

  it('grants only dashboard to a user with no permissions', async () => {
    const { service } = buildService({ 'org-1': [] });
    const resolved = await service.resolveForUser(makeUser());
    expect(resolved.enabledModuleIds).toEqual([]);
    expect(resolved.capabilities.granted).toEqual(['dashboard']);
  });

  it('does not invent module access from organization.manage alone', async () => {
    const { service } = buildService({ 'org-1': ['organization.manage'] });
    const resolved = await service.resolveForUser(makeUser());
    expect(resolved.permissions).toEqual(['organization.manage']);
    expect(resolved.enabledModuleIds).toEqual([]);
    expect(resolved.capabilities.granted).toEqual(['dashboard']);
  });

  it('is driven purely by permissions, not by role names', async () => {
    const { service } = buildService({ 'org-1': ['crm.read'] });
    const manager = await service.resolveForUser(makeUser({ role: 'MANAGER' }));
    const viewer = await service.resolveForUser(makeUser({ role: 'VIEWER' }));

    expect(manager.enabledModuleIds).toEqual(['crm']);
    expect(viewer.enabledModuleIds).toEqual(['crm']);
    expect(manager.enabledModuleIds).toEqual(viewer.enabledModuleIds);
  });

  it('is deterministic and reflects DB state on every call (no cache)', async () => {
    let calls = 0;
    const { registry, runtime } = buildRuntime();
    const rbac = {
      getUserPermissions: jest.fn(() => {
        calls += 1;
        return Promise.resolve(['crm.read']);
      }),
    } as unknown as RbacService;
    const service = new WorkspaceAccessService(
      rbac,
      new WorkspacePermissionMapper(),
      runtime,
      registry,
    );

    const first = await service.resolveForUser(makeUser());
    const second = await service.resolveForUser(makeUser());

    expect(calls).toBe(2);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).not.toBe(second);
  });
});
