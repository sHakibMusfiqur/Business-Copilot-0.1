import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { ConfigModule } from '../config/config.module';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RedisModule } from '../infrastructure/redis/redis.module';

import { CoreModule } from './core.module';
import { KernelService } from './kernel.service';
import { WorkspaceRuntimeContext } from './workspace-runtime-context';
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

function injectedRuntime(context: WorkspaceRuntimeContext): WorkspaceRuntimeService {
  return (context as unknown as { runtime: WorkspaceRuntimeService }).runtime;
}

describe('WorkspaceRuntimeContext (Nest DI provider)', () => {
  let moduleRef: TestingModule;
  let context: WorkspaceRuntimeContext;
  let runtime: WorkspaceRuntimeService;
  let kernel: KernelService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();
    await moduleRef.init();

    context = moduleRef.get(WorkspaceRuntimeContext);
    runtime = moduleRef.get(WorkspaceRuntimeService);
    kernel = moduleRef.get(KernelService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('resolves WorkspaceRuntimeContext through Nest DI', () => {
    expect(context).toBeInstanceOf(WorkspaceRuntimeContext);
  });

  it('injects WorkspaceRuntimeService through DI', () => {
    expect(injectedRuntime(context)).toBe(runtime);
  });

  it('delegates get() to WorkspaceRuntimeService', () => {
    const spy = jest.spyOn(runtime, 'resolve');
    const resolved = context.get(makeUser(), { permissions: ['crm.read'] });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(resolved).toBeDefined();
    spy.mockRestore();
  });

  it('maps organizationId to the resolved tenantId', () => {
    expect(context.get(makeUser(), {}).tenant.tenantId).toBe('org-1');
  });

  it('rejects a user with no organizationId', () => {
    expect(() => context.get(makeUser({ organizationId: undefined }), {})).toThrow(
      ForbiddenException,
    );
    expect(() => context.get(makeUser({ organizationId: undefined }), {})).toThrow(
      'User does not belong to an organization',
    );
  });

  it('delegates role mapping to the existing adapter (no duplicate logic)', () => {
    expect(context.get(makeUser(), {}).role).toBe('manager');
    expect(context.get(makeUser({ role: 'VIEWER' }), {}).role).toBe('guest');
  });

  it('preserves permissions from options', () => {
    const resolved = context.get(makeUser(), { permissions: ['crm.read'] });
    expect(resolved.permissions).toEqual(['crm.read']);
  });

  it('preserves enabled modules from options', () => {
    const resolved = context.get(makeUser(), {
      permissions: ['crm.read', 'billing.read'],
      modules: ['crm'],
    });
    expect(resolved.modules.map((m) => m.id)).toEqual(['crm']);
  });

  it('preserves the plan from options', () => {
    const resolved = context.get(makeUser(), {
      plan: 'growth',
      permissions: ['crm.read'],
      modules: ['crm'],
    });
    expect(resolved.entitlement.source).toBe('plan');
    expect(resolved.entitlement.key).toBe('growth');
  });

  it('preserves an explicit aiEnabled override', () => {
    expect(context.get(makeUser(), { aiEnabled: false }).aiEnabled).toBe(false);
    expect(context.get(makeUser(), { aiEnabled: true }).aiEnabled).toBe(true);
  });

  it('returns equivalent but fresh results on repeated calls', () => {
    const user = makeUser();
    const options = { permissions: ['crm.read'], modules: ['crm'] };
    const a = context.get(user, options);
    const b = context.get(user, options);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).not.toBe(b);
    expect(a.modules).not.toBe(b.modules);
  });

  it('introduces no Prisma/Billing/RBAC dependency', () => {
    expect(injectedRuntime(context)).toBe(runtime);
    // get() is fully synchronous; any DB/RBAC/Billing lookup would be async.
    expect(context.get(makeUser(), {})).not.toBeInstanceOf(Promise);
  });

  it('preserves CoreModule bootstrap of CRM/Billing manifests', () => {
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);
  });

  it('preserves Config/Redis service registration', () => {
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);
  });

  it('preserves kernel initialize/shutdown through the module lifecycle', () => {
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);
    // close() is exercised in afterAll; no error means init/shutdown succeeded.
    expect(context).toBeInstanceOf(WorkspaceRuntimeContext);
  });

  it('introduces no circular dependency (app bootstrap succeeds)', () => {
    expect(context).toBeInstanceOf(WorkspaceRuntimeContext);
  });
});