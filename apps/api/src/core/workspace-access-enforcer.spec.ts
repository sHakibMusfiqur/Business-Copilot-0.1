import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { EntitlementContext, ModuleManifest, ResolvedCapabilities } from '@bc/core';

import { ConfigModule } from '../config/config.module';
import { RedisModule } from '../infrastructure/redis/redis.module';

import { CoreModule } from './core.module';
import { KernelService } from './kernel.service';
import { WorkspaceAccessEnforcer } from './workspace-access-enforcer';
import { WorkspaceAccessPolicy } from './workspace-access-policy';
import type { ResolvedWorkspace } from './workspace-resolver';

const CRM: ModuleManifest = {
  id: 'crm',
  name: 'CRM & Leads',
  category: 'Relations',
  route: '/crm',
  permissions: ['crm.read'],
  capabilities: ['crm'],
  status: 'stable',
};

const BILLING: ModuleManifest = {
  id: 'billing',
  name: 'Billing & Plan',
  category: 'Administration',
  route: '/billing',
  permissions: ['billing.read'],
  capabilities: ['administration', 'platform'],
  status: 'stable',
};

function makeCapabilities(granted: string[]): ResolvedCapabilities {
  return {
    granted: granted as ResolvedCapabilities['granted'],
    can: (capability) => granted.includes(capability),
  };
}

function makeEntitlement(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return {
    key: 'default',
    name: 'Default',
    features: { reports: true, ai: false },
    modules: { crm: true, billing: false },
    limits: { users: 5, customers: 50, products: 50, storageGb: 1, aiCredits: 0 },
    trialDays: 30,
    source: 'default',
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<ResolvedWorkspace> = {}): ResolvedWorkspace {
  return {
    tenant: { tenantId: 'org-1', organizationName: null },
    role: 'manager',
    industry: null,
    permissions: ['crm.read', 'billing.read'],
    entitlement: makeEntitlement(),
    modules: [CRM, BILLING],
    enabledModuleIds: ['billing', 'crm'],
    capabilities: makeCapabilities(['dashboard', 'crm', 'administration', 'platform']),
    aiEnabled: false,
    ...overrides,
  };
}

function emptyWorkspace(): ResolvedWorkspace {
  return {
    tenant: { tenantId: null, organizationName: null },
    role: null,
    industry: null,
    permissions: [],
    entitlement: makeEntitlement({ features: {}, modules: {} }),
    modules: [],
    enabledModuleIds: [],
    capabilities: makeCapabilities(['dashboard']),
    aiEnabled: false,
  };
}

function expectDenied(fn: () => void, message: RegExp | string): void {
  expect(fn).toThrow(ForbiddenException);
  expect(fn).toThrow(message);
}

describe('WorkspaceAccessEnforcer (pure enforcement layer)', () => {
  const enforcer = new WorkspaceAccessEnforcer(new WorkspaceAccessPolicy());

  it('allows a granted capability', () => {
    expect(() => enforcer.requireCapability(makeWorkspace(), 'crm')).not.toThrow();
  });

  it('denies a missing capability', () => {
    expectDenied(
      () => enforcer.requireCapability(makeWorkspace(), 'inventory'),
      'Missing required capability: inventory',
    );
  });

  it('denies an unknown capability', () => {
    expectDenied(
      () => enforcer.requireCapability(makeWorkspace(), 'does-not-exist' as never),
      'Missing required capability: does-not-exist',
    );
  });

  it('allows an enabled module', () => {
    expect(() => enforcer.requireModule(makeWorkspace(), 'crm')).not.toThrow();
    expect(() => enforcer.requireModule(makeWorkspace(), 'billing')).not.toThrow();
  });

  it('denies a missing module', () => {
    expectDenied(
      () => enforcer.requireModule(makeWorkspace({ modules: [CRM] }), 'billing'),
      'Access to module "billing" is not allowed',
    );
  });

  it('denies an unknown module', () => {
    expectDenied(
      () => enforcer.requireModule(makeWorkspace(), 'does-not-exist'),
      'Access to module "does-not-exist" is not allowed',
    );
  });

  it('allows an existing permission', () => {
    expect(() => enforcer.requirePermission(makeWorkspace(), 'crm.read')).not.toThrow();
  });

  it('denies a missing permission', () => {
    expectDenied(
      () => enforcer.requirePermission(makeWorkspace(), 'users.create'),
      'Missing required permission: users.create',
    );
  });

  it('denies an unknown permission', () => {
    expectDenied(
      () => enforcer.requirePermission(makeWorkspace(), 'does-not-exist'),
      'Missing required permission: does-not-exist',
    );
  });

  it('allows an enabled feature', () => {
    expect(() => enforcer.requireFeature(makeWorkspace(), 'reports')).not.toThrow();
  });

  it('denies a disabled feature', () => {
    expectDenied(
      () => enforcer.requireFeature(makeWorkspace(), 'ai'),
      'Feature "ai" is not enabled',
    );
  });

  it('denies an unknown feature', () => {
    expectDenied(
      () => enforcer.requireFeature(makeWorkspace(), 'does-not-exist'),
      'Feature "does-not-exist" is not enabled',
    );
  });

  it('allows a usable module (resolved and entitled)', () => {
    expect(() => enforcer.requireUsableModule(makeWorkspace(), 'crm')).not.toThrow();
  });

  it('denies a module that is resolved but not entitled', () => {
    // Billing is resolved but entitlement.modules.billing === false.
    expectDenied(
      () => enforcer.requireUsableModule(makeWorkspace(), 'billing'),
      'Module "billing" is not usable',
    );
  });

  it('denies a module that is not resolved', () => {
    expectDenied(
      () => enforcer.requireUsableModule(makeWorkspace({ modules: [CRM] }), 'billing'),
      'Module "billing" is not usable',
    );
  });

  it('safely denies all non-dashboard checks on an empty workspace', () => {
    const workspace = emptyWorkspace();
    expectDenied(() => enforcer.requireCapability(workspace, 'crm'), 'crm');
    expectDenied(() => enforcer.requireModule(workspace, 'crm'), 'crm');
    expectDenied(() => enforcer.requireUsableModule(workspace, 'crm'), 'crm');
    expectDenied(() => enforcer.requirePermission(workspace, 'crm.read'), 'crm.read');
    expectDenied(() => enforcer.requireFeature(workspace, 'reports'), 'reports');
  });

  it('dashboard capability passes even on an empty workspace', () => {
    expect(() => enforcer.requireCapability(emptyWorkspace(), 'dashboard')).not.toThrow();
  });

  it('does not mutate the workspace', () => {
    const workspace = makeWorkspace();
    const snapshot = JSON.stringify(workspace);
    Object.freeze(workspace);
    enforcer.requireCapability(workspace, 'crm');
    enforcer.requireModule(workspace, 'crm');
    enforcer.requirePermission(workspace, 'crm.read');
    enforcer.requireFeature(workspace, 'reports');
    enforcer.requireUsableModule(workspace, 'crm');
    expect(JSON.stringify(workspace)).toBe(snapshot);
  });

  it('is deterministic across repeated evaluations', () => {
    const workspace = makeWorkspace();
    const evaluate = () => {
      try {
        enforcer.requireCapability(workspace, 'crm');
        enforcer.requireUsableModule(workspace, 'crm');
        enforcer.requirePermission(workspace, 'crm.read');
        return 'allow';
      } catch {
        return 'deny';
      }
    };
    expect(evaluate()).toBe('allow');
    expect(evaluate()).toBe('allow');
  });

  it('does not access DB/Billing/RBAC (synchronous pure evaluations)', () => {
    const workspace = makeWorkspace();
    const results = [
      enforcer.requireCapability(workspace, 'crm'),
      enforcer.requireModule(workspace, 'crm'),
      enforcer.requirePermission(workspace, 'crm.read'),
      enforcer.requireFeature(workspace, 'reports'),
      enforcer.requireUsableModule(workspace, 'crm'),
    ];
    results.forEach((result) => expect(result).toBeUndefined());
  });
});

describe('WorkspaceAccessEnforcer (Nest DI registration)', () => {
  it('resolves through CoreModule DI, shares the policy, and bootstraps cleanly', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();
    await moduleRef.init();

    const enforcer = moduleRef.get(WorkspaceAccessEnforcer);
    expect(enforcer).toBeInstanceOf(WorkspaceAccessEnforcer);
    expect(enforcer).toBe(moduleRef.get(WorkspaceAccessEnforcer));

    // Existing bootstrap still works alongside the new provider.
    const kernel = moduleRef.get(KernelService);
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);

    await moduleRef.close();
  });
});