import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { ConfigModule } from '../config/config.module';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RedisModule } from '../infrastructure/redis/redis.module';

import { CoreModule } from './core.module';
import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';
import { UnsupportedRoleError, WorkspaceContextAdapter } from './workspace-context.adapter';
import { WorkspaceResolver } from './workspace-resolver';
import { WorkspaceRuntimeService } from './workspace-runtime.service';

function makeUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    id: 'user-1',
    email: 'owner@acme.com',
    role: 'MANAGER',
    organizationId: 'org-1',
    ...overrides,
  };
}

function serviceDeps(service: WorkspaceRuntimeService): {
  adapter: WorkspaceContextAdapter;
  resolver: WorkspaceResolver;
  registry: ModuleRegistry;
} {
  return service as unknown as {
    adapter: WorkspaceContextAdapter;
    resolver: WorkspaceResolver;
    registry: ModuleRegistry;
  };
}

describe('WorkspaceRuntimeService (Nest DI facade)', () => {
  let moduleRef: TestingModule;
  let service: WorkspaceRuntimeService;
  let kernel: KernelService;
  let registry: ModuleRegistry;
  let adapter: WorkspaceContextAdapter;
  let resolver: WorkspaceResolver;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(WorkspaceRuntimeService);
    kernel = moduleRef.get(KernelService);
    registry = moduleRef.get(ModuleRegistry);
    adapter = moduleRef.get(WorkspaceContextAdapter);
    resolver = moduleRef.get(WorkspaceResolver);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('resolves WorkspaceRuntimeService through Nest DI', () => {
    expect(service).toBeInstanceOf(WorkspaceRuntimeService);
  });

  it('injects the WorkspaceContextAdapter', () => {
    expect(serviceDeps(service).adapter).toBe(adapter);
  });

  it('injects the WorkspaceResolver', () => {
    expect(serviceDeps(service).resolver).toBe(resolver);
  });

  it('injects the ModuleRegistry', () => {
    expect(serviceDeps(service).registry).toBe(registry);
  });

  it('maps user.organizationId to the resolved tenantId', () => {
    const resolved = service.resolve(makeUser(), {});
    expect(resolved.tenant.tenantId).toBe('org-1');
  });

  it('rejects a user with no organizationId', () => {
    expect(() => service.resolve(makeUser({ organizationId: undefined }), {})).toThrow(
      ForbiddenException,
    );
    expect(() => service.resolve(makeUser({ organizationId: undefined }), {})).toThrow(
      'User does not belong to an organization',
    );
  });

  it('never allows the caller to override tenantId', () => {
    const resolved = service.resolve(
      makeUser(),
      { organizationName: 'Evil Corp', permissions: [], modules: ['crm'] },
    );
    expect(resolved.tenant.tenantId).toBe('org-1');
    expect(resolved.tenant.organizationName).toBe('Evil Corp');
  });

  it('delegates role mapping entirely to the WorkspaceContextAdapter', () => {
    // MANAGER -> canonical 'manager' via the adapter mapping.
    expect(service.resolve(makeUser(), {}).role).toBe('manager');
    expect(service.resolve(makeUser({ role: 'VIEWER' }), {}).role).toBe('guest');
    // Every actual UserRole enum value maps; truly unknown roles fail in the
    // adapter — the facade never invents one.
    expect(service.resolve(makeUser({ role: 'ADMIN' }), {}).role).toBe('manager');
    expect(service.resolve(makeUser({ role: 'USER' }), {}).role).toBe('employee');
    expect(() => service.resolve(makeUser({ role: 'unknown_role' }), {})).toThrow(
      UnsupportedRoleError,
    );
  });

  it('forwards permissions from options into the resolution', () => {
    const resolved = service.resolve(
      makeUser(),
      { permissions: ['crm.read'] },
    );
    expect(resolved.permissions).toEqual(['crm.read']);
  });

  it('forwards enabled modules from options into the resolution', () => {
    const resolved = service.resolve(
      makeUser(),
      { permissions: ['crm.read', 'billing.read'], modules: ['crm'] },
    );
    expect(resolved.modules.map((m) => m.id)).toEqual(['crm']);
  });

  it('forwards the plan from options into the entitlement', () => {
    const resolved = service.resolve(
      makeUser(),
      { plan: 'growth', permissions: ['crm.read'], modules: ['crm'] },
    );
    expect(resolved.entitlement.source).toBe('plan');
    expect(resolved.entitlement.key).toBe('growth');
  });

  it('forwards an explicit aiEnabled override', () => {
    expect(service.resolve(makeUser(), { aiEnabled: false }).aiEnabled).toBe(false);
    expect(service.resolve(makeUser(), { aiEnabled: true }).aiEnabled).toBe(true);
  });

  it('resolves using the registered CRM/Billing manifests', async () => {
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);

    const resolved = service.resolve(
      makeUser(),
      { permissions: ['crm.read', 'billing.read'], modules: ['crm', 'billing'] },
    );
    expect(resolved.modules.map((m) => m.id)).toEqual(['billing', 'crm']);
  });

  it('derives capabilities through the pipeline', () => {
    const resolved = service.resolve(
      makeUser(),
      { permissions: ['crm.read'], modules: ['crm'] },
    );
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('inventory')).toBe(false);
  });

  it('derives entitlement through the pipeline', () => {
    const resolved = service.resolve(
      makeUser(),
      { permissions: ['crm.read', 'billing.read'], modules: ['crm', 'billing'] },
    );
    expect(resolved.entitlement.source).toBe('default');
    expect(Object.keys(resolved.entitlement.modules)).toEqual(['billing', 'crm']);
  });

  it('reflects enabledModuleIds from the actually resolved modules', () => {
    const resolved = service.resolve(
      makeUser(),
      { permissions: ['crm.read', 'billing.read'], modules: ['crm', 'billing'] },
    );
    expect(resolved.enabledModuleIds).toEqual(['billing', 'crm']);
    expect(resolved.enabledModuleIds).toEqual(resolved.modules.map((m) => m.id));
  });

  it('is deterministic and returns a fresh result on every call', () => {
    const user = makeUser();
    const options = { permissions: ['crm.read'], modules: ['crm'] };
    const first = service.resolve(user, options);
    const second = service.resolve(user, options);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).not.toBe(second);
    expect(first.modules).not.toBe(second.modules);
  });

  it('introduces no Prisma/Billing/RBAC dependency', () => {
    // The facade only composes adapter + resolver + registry; the DI graph
    // compiled without Prisma/Rbac/Billing modules.
    expect(serviceDeps(service).registry).toBe(registry);
    expect(serviceDeps(service).adapter).toBe(adapter);
    expect(serviceDeps(service).resolver).toBe(resolver);
    // resolve() is fully synchronous — any DB/RBAC/Billing lookup would be async.
    expect(service.resolve(makeUser(), {})).not.toBeInstanceOf(Promise);
  });

  it('preserves CoreModule bootstrap of CRM/Billing + Config/Redis + kernel lifecycle', () => {
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);
  });

  it('introduces no circular dependency (app bootstrap succeeds)', () => {
    // Compilation + init already succeeded; a circular DI graph would have thrown.
    expect(service).toBeInstanceOf(WorkspaceRuntimeService);
  });
});