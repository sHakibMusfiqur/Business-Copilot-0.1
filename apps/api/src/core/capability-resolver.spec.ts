import type { ModuleManifest, ResolvedCapabilities } from '@bc/core';

import { CapabilityResolver } from './capability-resolver';

const CRM: ModuleManifest = {
  id: 'crm',
  name: 'CRM & Leads',
  category: 'Relations',
  route: '/crm',
  permissions: [],
  capabilities: ['crm'],
  status: 'stable',
};

const BILLING: ModuleManifest = {
  id: 'billing',
  name: 'Billing & Plan',
  category: 'Administration',
  route: '/billing',
  permissions: [],
  capabilities: ['administration', 'platform'],
  status: 'stable',
};

const resolver = new CapabilityResolver();

describe('CapabilityResolver', () => {
  it('always grants the dashboard capability', () => {
    const resolved = resolver.resolve([]);
    expect(resolved.granted).toContain('dashboard');
    expect(resolved.can('dashboard')).toBe(true);
  });

  it('grants the crm capability from the CRM module', () => {
    const resolved = resolver.resolve([CRM]);
    expect(resolved.granted).toContain('crm');
    expect(resolved.can('crm')).toBe(true);
  });

  it('merges capabilities from multiple modules', () => {
    const resolved = resolver.resolve([CRM, BILLING]);
    for (const capability of ['dashboard', 'crm', 'administration', 'platform']) {
      expect(resolved.granted).toContain(capability as never);
    }
  });

  it('de-duplicates repeated capabilities across modules', () => {
    const resolved = resolver.resolve([CRM, { ...CRM, id: 'crm-2' }]);
    expect(resolved.granted.filter((c) => c === 'crm')).toHaveLength(1);
  });

  it('restricts module-derived capabilities via the allow-list', () => {
    const resolved = resolver.resolve([CRM, BILLING], ['crm']);
    expect(resolved.granted).toContain('dashboard');
    expect(resolved.can('crm')).toBe(true);
    expect(resolved.can('administration')).toBe(false);
    expect(resolved.can('platform')).toBe(false);
  });

  it('leaves only dashboard when the allow-list is empty', () => {
    const resolved = resolver.resolve([CRM, BILLING], []);
    expect(resolved.granted).toEqual(['dashboard']);
  });

  it('does not grant a capability no module declares', () => {
    const resolved = resolver.resolve([CRM]);
    expect(resolved.can('inventory')).toBe(false);
    expect(resolved.granted).not.toContain('inventory');
  });

  it('ignores unknown capability strings at runtime', () => {
    const unknownCapabilityModule = {
      ...CRM,
      id: 'bogus',
      capabilities: ['crm', 'not-a-real-capability'],
    } as ModuleManifest;
    const resolved = resolver.resolve([unknownCapabilityModule]);
    expect(resolved.granted).toContain('crm');
    expect(resolved.granted).not.toContain('not-a-real-capability');
    for (const entry of resolved.granted) {
      expect([
        'dashboard',
        'analytics',
        'reports',
        'crm',
        'accounting',
        'finance',
        'inventory',
        'procurement',
        'manufacturing',
        'hr',
        'payroll',
        'pos',
        'ecommerce',
        'ai',
        'workflow',
        'administration',
        'platform',
      ]).toContain(entry);
    }
  });

  it('produces identical output regardless of module registration order', () => {
    const forward = resolver.resolve([CRM, BILLING]);
    const reversed = resolver.resolve([BILLING, CRM]);
    expect(forward.granted).toEqual(reversed.granted);
    expect(resolver.resolve([CRM]).granted).toEqual(
      resolver.resolve([{ ...CRM, id: 'renamed' }]).granted,
    );
  });

  it('does not mutate the input module array or manifests', () => {
    const modules = [CRM, BILLING];
    const snapshot = JSON.stringify(modules);
    resolver.resolve(modules);
    expect(JSON.stringify(modules)).toBe(snapshot);
    expect(JSON.stringify(modules[0].capabilities)).toBe(JSON.stringify(CRM.capabilities));
  });

  it('returns true via can() for a granted capability', () => {
    const resolved = resolver.resolve([CRM]);
    expect(resolved.can('crm')).toBe(true);
  });

  it('returns false via can() for a missing or unknown capability', () => {
    const resolved = resolver.resolve([CRM]);
    expect(resolved.can('workflow')).toBe(false);
    // Unknown strings are never granted.
    expect((resolved.can as (c: string) => boolean)('nonexistent')).toBe(false);
  });

  it('is idempotent and returns a fresh, stable result per call', () => {
    const modules = [CRM, BILLING];
    const first: ResolvedCapabilities = resolver.resolve(modules);
    const second: ResolvedCapabilities = resolver.resolve(modules, ['crm']);
    expect(first.granted).toEqual(['administration', 'crm', 'dashboard', 'platform']);
    expect(second.granted).toEqual(['crm', 'dashboard']);
    // Fresh object/array per call (no hidden mutable state).
    expect(resolver.resolve(modules).granted).not.toBe(first.granted);
  });
});