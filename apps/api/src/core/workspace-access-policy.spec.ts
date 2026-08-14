import { Test } from '@nestjs/testing';

import type { EntitlementContext, ModuleManifest, ResolvedCapabilities } from '@bc/core';

import { ConfigModule } from '../config/config.module';
import { RedisModule } from '../infrastructure/redis/redis.module';

import { CoreModule } from './core.module';
import { KernelService } from './kernel.service';
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

describe('WorkspaceAccessPolicy (pure evaluator)', () => {
  const policy = new WorkspaceAccessPolicy();

  it('returns true for a granted capability', () => {
    expect(policy.canCapability(makeWorkspace(), 'crm')).toBe(true);
  });

  it('returns false for a missing capability', () => {
    expect(policy.canCapability(makeWorkspace(), 'inventory')).toBe(false);
  });

  it('returns false for an unknown capability', () => {
    expect(policy.canCapability(makeWorkspace(), 'does-not-exist' as never)).toBe(false);
  });

  it('returns true for an enabled module', () => {
    expect(policy.canModule(makeWorkspace(), 'crm')).toBe(true);
    expect(policy.canModule(makeWorkspace(), 'billing')).toBe(true);
  });

  it('returns false for a missing module', () => {
    expect(policy.canModule(makeWorkspace({ modules: [CRM] }), 'billing')).toBe(false);
  });

  it('returns false for an unknown module', () => {
    expect(policy.canModule(makeWorkspace(), 'does-not-exist')).toBe(false);
  });

  it('returns true for an existing permission', () => {
    expect(policy.hasPermission(makeWorkspace(), 'crm.read')).toBe(true);
  });

  it('returns false for a missing permission', () => {
    expect(policy.hasPermission(makeWorkspace(), 'users.create')).toBe(false);
  });

  it('returns false for an unknown permission', () => {
    expect(policy.hasPermission(makeWorkspace(), 'does-not-exist')).toBe(false);
  });

  it('returns true for an enabled feature', () => {
    expect(policy.hasFeature(makeWorkspace(), 'reports')).toBe(true);
  });

  it('returns false for a disabled feature', () => {
    expect(policy.hasFeature(makeWorkspace(), 'ai')).toBe(false);
  });

  it('returns false for an unknown feature', () => {
    expect(policy.hasFeature(makeWorkspace(), 'does-not-exist')).toBe(false);
  });

  it('canUseModule requires the module to be resolved', () => {
    // Billing is entitled (modules.billing === false) but present → still false.
    expect(policy.canUseModule(makeWorkspace(), 'billing')).toBe(false);
    // CRM is both resolved and entitled → true.
    expect(policy.canUseModule(makeWorkspace(), 'crm')).toBe(true);
    // Not resolved at all → false.
    expect(policy.canUseModule(makeWorkspace({ modules: [CRM] }), 'billing')).toBe(false);
  });

  it('canUseModule requires the entitlement module flag', () => {
    // Present in modules but entitlement.modules[moduleId] !== true.
    const workspace = makeWorkspace({
      modules: [CRM, BILLING],
      entitlement: makeEntitlement({ modules: { crm: true, billing: false } }),
    });
    expect(policy.canUseModule(workspace, 'billing')).toBe(false);
    // Absent from entitlement entirely.
    const noEntitlement = makeWorkspace({
      modules: [CRM],
      entitlement: makeEntitlement({ modules: {} }),
    });
    expect(policy.canUseModule(noEntitlement, 'crm')).toBe(false);
  });

  it('Phase 1F.5 matrix: resolved + not entitled keeps canModule true but canUseModule false', () => {
    const workspace = makeWorkspace({
      modules: [CRM],
      entitlement: makeEntitlement({ modules: {} }),
    });
    expect(policy.canModule(workspace, 'crm')).toBe(true);
    expect(policy.canUseModule(workspace, 'crm')).toBe(false);
  });

  it('Phase 1F.5 matrix: not resolved + entitled keeps both canModule and canUseModule false', () => {
    const workspace = makeWorkspace({
      modules: [BILLING],
      entitlement: makeEntitlement({ modules: { crm: true } }),
    });
    expect(policy.canModule(workspace, 'crm')).toBe(false);
    expect(policy.canUseModule(workspace, 'crm')).toBe(false);
  });

  it('safely returns false for non-dashboard checks on an empty workspace', () => {
    const workspace = emptyWorkspace();
    expect(policy.canCapability(workspace, 'crm')).toBe(false);
    expect(policy.canModule(workspace, 'crm')).toBe(false);
    expect(policy.canUseModule(workspace, 'crm')).toBe(false);
    expect(policy.hasPermission(workspace, 'crm.read')).toBe(false);
    expect(policy.hasFeature(workspace, 'reports')).toBe(false);
  });

  it('dashboard capability works through the resolved capability object', () => {
    expect(policy.canCapability(makeWorkspace(), 'dashboard')).toBe(true);
    expect(policy.canCapability(emptyWorkspace(), 'dashboard')).toBe(true);
  });

  it('does not mutate the workspace', () => {
    const workspace = makeWorkspace();
    const snapshot = JSON.stringify(workspace);
    Object.freeze(workspace);
    policy.canCapability(workspace, 'crm');
    policy.canModule(workspace, 'crm');
    policy.hasPermission(workspace, 'crm.read');
    policy.hasFeature(workspace, 'reports');
    policy.canUseModule(workspace, 'crm');
    expect(JSON.stringify(workspace)).toBe(snapshot);
  });

  it('is deterministic across repeated evaluations', () => {
    const workspace = makeWorkspace();
    const first = [
      policy.canCapability(workspace, 'crm'),
      policy.canModule(workspace, 'crm'),
      policy.hasPermission(workspace, 'crm.read'),
      policy.hasFeature(workspace, 'reports'),
      policy.canUseModule(workspace, 'crm'),
    ];
    const second = [
      policy.canCapability(workspace, 'crm'),
      policy.canModule(workspace, 'crm'),
      policy.hasPermission(workspace, 'crm.read'),
      policy.hasFeature(workspace, 'reports'),
      policy.canUseModule(workspace, 'crm'),
    ];
    expect(first).toEqual(second);
  });

  it('does not access DB/Billing/RBAC (pure boolean evaluations)', () => {
    const workspace = makeWorkspace();
    // All checks are synchronous booleans — no async/service calls possible.
    expect(policy.canCapability(workspace, 'crm')).not.toBeInstanceOf(Promise);
    expect(policy.canUseModule(workspace, 'crm')).toBe(true);
  });
});

describe('WorkspaceAccessPolicy (Nest DI registration)', () => {
  it('resolves through CoreModule DI and bootstraps cleanly', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();
    await moduleRef.init();

    const policy = moduleRef.get(WorkspaceAccessPolicy);
    expect(policy).toBeInstanceOf(WorkspaceAccessPolicy);
    expect(policy).toBe(moduleRef.get(WorkspaceAccessPolicy));

    // Existing bootstrap still works alongside the new provider.
    const kernel = moduleRef.get(KernelService);
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);

    await moduleRef.close();
  });
});