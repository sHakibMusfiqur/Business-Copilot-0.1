import type {
  CapabilityKey,
  ModuleManifest,
  WorkspaceContextInput,
} from '@bc/core';

import { WorkspaceResolver } from './workspace-resolver';

const CRM: ModuleManifest = {
  id: 'crm',
  name: 'CRM & Leads',
  category: 'Relations',
  route: '/crm',
  permissions: ['crm.read'],
  capabilities: ['crm'],
  status: 'stable',
};

const AI_MODULE: ModuleManifest = {
  id: 'ai',
  name: 'AI Assistant',
  category: 'Operations',
  route: '/ai',
  permissions: ['ai.read'],
  capabilities: ['ai'],
  status: 'beta',
};

const INVENTORY: ModuleManifest = {
  id: 'inventory',
  name: 'Inventory',
  category: 'Operations',
  route: '/inventory',
  permissions: ['inventory.read'],
  capabilities: ['inventory'],
  status: 'stable',
};

/** Builds a WorkspaceContextInput, allowing optional capabilities/aiEnabled overrides. */
function context(
  partial: Partial<WorkspaceContextInput> & {
    capabilities?: CapabilityKey[];
    aiEnabled?: boolean;
  },
): WorkspaceContextInput {
  return partial as unknown as WorkspaceContextInput;
}

const resolver = new WorkspaceResolver();

describe('WorkspaceResolver', () => {
  it('resolves a basic workspace', () => {
    const resolved = resolver.resolve(
      context({
        tenantId: 't1',
        organizationName: 'Acme',
        role: 'owner',
        industry: 'retail',
        permissions: ['crm.read'],
        modules: ['crm'],
      }),
      [CRM],
    );
    expect(resolved.tenant.tenantId).toBe('t1');
    expect(resolved.modules.map((m) => m.id)).toContain('crm');
    expect(resolved.capabilities.granted).toContain('crm');
    expect(resolved.entitlement.source).toBe('default');
  });

  it('propagates the tenant id', () => {
    const resolved = resolver.resolve(
      context({ tenantId: 'tenant-42', permissions: [], modules: [] }),
      [CRM],
    );
    expect(resolved.tenant.tenantId).toBe('tenant-42');
  });

  it('propagates the organization name', () => {
    const resolved = resolver.resolve(
      context({ organizationName: 'Globex', permissions: [], modules: [] }),
      [CRM],
    );
    expect(resolved.tenant.organizationName).toBe('Globex');
  });

  it('preserves the role', () => {
    const resolved = resolver.resolve(
      context({ role: 'manager', permissions: [], modules: [] }),
      [],
    );
    expect(resolved.role).toBe('manager');
  });

  it('preserves the industry', () => {
    const resolved = resolver.resolve(
      context({ industry: 'pharmacy', permissions: [], modules: [] }),
      [],
    );
    expect(resolved.industry).toBe('pharmacy');
  });

  it('resolves modules through ModuleResolver', () => {
    const resolved = resolver.resolve(
      context({
        permissions: ['crm.read', 'ai.read'],
        modules: ['crm', 'ai'],
      }),
      [CRM, AI_MODULE],
    );
    expect(resolved.modules.map((m) => m.id)).toEqual(['ai', 'crm']);
  });

  it('derives capabilities through CapabilityResolver', () => {
    const resolved = resolver.resolve(
      context({ permissions: ['crm.read'], modules: ['crm'] }),
      [CRM],
    );
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('inventory')).toBe(false);
  });

  it('respects entitlement module restrictions', () => {
    const resolved = resolver.resolve(
      context({
        permissions: ['crm.read', 'inventory.read'],
        modules: ['crm'],
      }),
      [CRM, INVENTORY],
    );
    expect(resolved.modules.map((m) => m.id)).toEqual(['crm']);
    expect(resolved.modules.find((m) => m.id === 'inventory')).toBeUndefined();
  });

  it('removes a module when its capability is missing', () => {
    const resolved = resolver.resolve(
      context({
        permissions: ['crm.read', 'inventory.read'],
        modules: ['crm', 'inventory'],
        capabilities: ['crm'],
      }),
      [CRM, INVENTORY],
    );
    expect(resolved.modules.map((m) => m.id)).toEqual(['crm']);
    expect(resolved.capabilities.can('inventory')).toBe(false);
  });

  it('removes a module when a required permission is missing', () => {
    const resolved = resolver.resolve(
      context({ permissions: [], modules: ['crm'] }),
      [CRM],
    );
    expect(resolved.modules).toHaveLength(0);
  });

  it('disables AI when explicitly false despite the ai capability', () => {
    const resolved = resolver.resolve(
      context({ permissions: ['ai.read'], modules: ['ai'], aiEnabled: false }),
      [AI_MODULE],
    );
    expect(resolved.capabilities.can('ai')).toBe(true);
    expect(resolved.aiEnabled).toBe(false);
  });

  it('enables AI from capability when not explicitly overridden', () => {
    const resolved = resolver.resolve(
      context({ permissions: ['ai.read'], modules: ['ai'] }),
      [AI_MODULE],
    );
    expect(resolved.aiEnabled).toBe(true);
  });

  it('reflects enabledModuleIds from actually resolved modules', () => {
    const resolved = resolver.resolve(
      context({
        permissions: ['crm.read', 'inventory.read'],
        modules: ['crm', 'inventory'],
        capabilities: ['crm'],
      }),
      [CRM, INVENTORY],
    );
    expect(resolved.enabledModuleIds).toEqual(['crm']);
  });

  it('produces deterministic output for identical inputs', () => {
    const input = context({ permissions: ['crm.read'], modules: ['crm'], role: 'owner' });
    const a = resolver.resolve(input, [CRM]);
    const b = resolver.resolve(context({ permissions: ['crm.read'], modules: ['crm'], role: 'owner' }), [CRM]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.modules.map((m) => m.id)).toEqual(b.modules.map((m) => m.id));
  });

  it('does not mutate the input context or manifests', () => {
    const input = context({ permissions: ['crm.read'], modules: ['crm'], tenantId: 't1' });
    const manifests = [CRM, AI_MODULE];
    const inputSnapshot = JSON.stringify(input);
    const manifestsSnapshot = JSON.stringify(manifests);
    resolver.resolve(input, manifests);
    expect(JSON.stringify(input)).toBe(inputSnapshot);
    expect(JSON.stringify(manifests)).toBe(manifestsSnapshot);
  });

  it('returns equivalent results across repeated calls', () => {
    const input = context({ permissions: ['crm.read'], modules: ['crm'] });
    const first = resolver.resolve(input, [CRM]);
    const second = resolver.resolve(context({ permissions: ['crm.read'], modules: ['crm'] }), [CRM]);
    expect(first).not.toBe(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('resolves without any database or billing dependency', () => {
    const resolved = resolver.resolve(
      context({ permissions: [], modules: [] }),
      [],
    );
    expect(typeof resolved).toBe('object');
    expect(resolved.capabilities.granted).toEqual(['dashboard']);
    expect(resolved.entitlement.source).toBe('default');
  });

  it('explicit plan switches entitlement source to plan', () => {
    const resolved = resolver.resolve(
      context({ plan: 'growth', permissions: [], modules: [] }),
      [],
    );
    expect(resolved.entitlement.source).toBe('plan');
    expect(resolved.entitlement.key).toBe('growth');
  });

  it('empty module list resolves no modules and keeps only dashboard', () => {
    const resolved = resolver.resolve(
      context({ permissions: ['crm.read'], modules: [] }),
      [CRM],
    );
    expect(resolved.modules).toHaveLength(0);
    expect(resolved.enabledModuleIds).toEqual([]);
    expect(resolved.capabilities.granted).toEqual(['dashboard']);
  });
});