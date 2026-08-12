import type { ModuleManifest } from '@bc/core';

import { ModuleResolver, type ModuleResolverContext } from './module-resolver';

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

const HR_ADMIN: ModuleManifest = {
  id: 'hr-admin',
  name: 'HR Admin',
  category: 'People',
  route: '/hr',
  permissions: ['hr.read'],
  capabilities: ['hr'],
  status: 'stable',
  visibility: { roles: ['hr'] },
};

const POS: ModuleManifest = {
  id: 'pos',
  name: 'Point of Sale',
  category: 'Operations',
  route: '/pos',
  permissions: ['pos.read'],
  capabilities: ['pos'],
  status: 'beta',
  industries: ['retail'],
};

const MANIFESTS: ModuleManifest[] = [CRM, BILLING, HR_ADMIN, POS];

function makeContext(overrides: Partial<ModuleResolverContext>): ModuleResolverContext {
  return { capabilities: [], permissions: [], ...overrides };
}

describe('ModuleResolver', () => {
  const resolver = new ModuleResolver(MANIFESTS);

  it('resolves a registered module when its capability matches', () => {
    const context = makeContext({ capabilities: ['crm'], permissions: ['crm.read'] });
    expect(resolver.isEnabled('crm', context)).toBe(true);
    expect(resolver.resolve(context).map((m) => m.id)).toContain('crm');
  });

  it('excludes a module when a required capability is missing', () => {
    const context = makeContext({ capabilities: ['administration'], permissions: ['crm.read'] });
    expect(resolver.isEnabled('crm', context)).toBe(false);
    expect(resolver.resolve(context).map((m) => m.id)).not.toContain('crm');
  });

  it('excludes a module when a required permission is missing', () => {
    const context = makeContext({ capabilities: ['crm'], permissions: [] });
    expect(resolver.isEnabled('crm', context)).toBe(false);
    expect(resolver.resolve(context).map((m) => m.id)).not.toContain('crm');
  });

  it('allows a module for a matching role', () => {
    const context = makeContext({
      role: 'hr',
      capabilities: ['hr'],
      permissions: ['hr.read'],
    });
    expect(resolver.isEnabled('hr-admin', context)).toBe(true);
  });

  it('excludes a module for a mismatched role', () => {
    const context = makeContext({
      role: 'sales',
      capabilities: ['hr'],
      permissions: ['hr.read'],
    });
    expect(resolver.isEnabled('hr-admin', context)).toBe(false);
  });

  it('allows a module for a matching industry', () => {
    const context = makeContext({
      industry: 'retail',
      capabilities: ['pos'],
      permissions: ['pos.read'],
    });
    expect(resolver.isEnabled('pos', context)).toBe(true);
  });

  it('excludes a module for a mismatched industry', () => {
    const context = makeContext({
      industry: 'restaurant',
      capabilities: ['pos'],
      permissions: ['pos.read'],
    });
    expect(resolver.isEnabled('pos', context)).toBe(false);
  });

  it('respects an explicit enabledModules allow-list', () => {
    const context = makeContext({
      capabilities: ['crm', 'administration', 'platform'],
      permissions: ['crm.read', 'billing.read'],
      enabledModules: ['crm'],
    });
    const resolved = resolver.resolve(context).map((m) => m.id);
    expect(resolved).toEqual(['crm']);
  });

  it('never returns or enables an unknown module', () => {
    const context = makeContext({ capabilities: ['crm'], permissions: ['crm.read'] });
    expect(resolver.isEnabled('does-not-exist', context)).toBe(false);
    expect(resolver.resolve(context).map((m) => m.id)).not.toContain('does-not-exist');
  });

  it('is deterministic and does not mutate the registry', () => {
    const manifests = [...MANIFESTS];
    const r = new ModuleResolver(manifests);
    const context = makeContext({
      capabilities: ['crm', 'administration', 'platform'],
      permissions: ['crm.read', 'billing.read'],
    });

    const first = JSON.stringify(r.resolve(context));
    const second = JSON.stringify(r.resolve(context));

    expect(first).toBe(second);
    // Underlying manifests are untouched (same array, same contents).
    expect(manifests).toHaveLength(MANIFESTS.length);
    expect(JSON.stringify(manifests)).toBe(JSON.stringify(MANIFESTS));
  });
});