import { EntitlementResolver } from './entitlement-resolver';

const resolver = new EntitlementResolver();

describe('EntitlementResolver', () => {
  it('returns a default entitlement context for null/undefined input', () => {
    for (const input of [undefined, null]) {
      const context = resolver.resolve(input);
      expect(context.source).toBe('default');
      expect(context.key).toBe('default');
      expect(context.features).toEqual({});
      expect(context.modules).toEqual({});
      expect(context.trialDays).toBe(30);
      // Conservative defaults, never unlimited.
      expect(context.limits.users).toBeLessThanOrEqual(5);
      expect(context.limits.aiCredits).toBeLessThanOrEqual(0);
      expect(context.status).toBeUndefined();
    }
  });

  it('switches source to plan when an explicit plan is provided', () => {
    const context = resolver.resolve({ plan: 'growth' });
    expect(context.source).toBe('plan');
    expect(context.key).toBe('growth');
  });

  it('preserves provided feature flags', () => {
    const context = resolver.resolve({ plan: 'x', features: { reports: true, '2fa': true } });
    expect(context.features.reports).toBe(true);
    expect(context.features['2fa']).toBe(true);
  });

  it('preserves an explicit false feature flag', () => {
    const context = resolver.resolve({ plan: 'x', features: { reports: false } });
    expect(context.features.reports).toBe(false);
  });

  it('preserves the provided module list', () => {
    const context = resolver.resolve({ plan: 'x', modules: ['crm', 'billing', 'inventory'] });
    expect(context.modules.crm).toBe(true);
    expect(context.modules.billing).toBe(true);
    expect(context.modules.inventory).toBe(true);
  });

  it('removes duplicate modules', () => {
    const context = resolver.resolve({ plan: 'x', modules: ['crm', 'crm', 'billing', 'crm'] });
    const ids = Object.keys(context.modules);
    expect(ids.filter((id) => id === 'crm')).toHaveLength(1);
  });

  it('orders modules deterministically', () => {
    const a = resolver.resolve({ plan: 'x', modules: ['billing', 'crm', 'ai'] });
    const b = resolver.resolve({ plan: 'x', modules: ['crm', 'ai', 'billing'] });
    expect(Object.keys(a.modules)).toEqual(['ai', 'billing', 'crm']);
    expect(Object.keys(b.modules)).toEqual(Object.keys(a.modules));
  });

  it('merges partial limits over the defaults', () => {
    const context = resolver.resolve({ plan: 'x', limits: { users: 20, aiCredits: 100 } });
    expect(context.limits.users).toBe(20);
    expect(context.limits.aiCredits).toBe(100);
    // Untouched limit keys keep their conservative default.
    expect(context.limits.customers).toBe(50);
    expect(context.limits.products).toBe(50);
    expect(context.limits.storageGb).toBe(1);
  });

  it('always returns all required UsageLimits fields', () => {
    const context = resolver.resolve({ plan: 'x', limits: { users: 3 } });
    for (const key of ['users', 'customers', 'products', 'storageGb', 'aiCredits'] as const) {
      expect(typeof context.limits[key]).toBe('number');
    }
  });

  it('preserves the provided status', () => {
    const context = resolver.resolve({ plan: 'x', status: 'trialing' });
    expect(context.status).toBe('trialing');
  });

  it('does not mutate the input object', () => {
    const input = { plan: 'growth', features: { reports: true }, modules: ['crm', 'billing'], limits: { users: 7 }, status: 'active' };
    const snapshot = JSON.stringify(input);
    resolver.resolve(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    resolver.resolve({ limits: { users: 1 } });
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('returns equivalent output on repeated resolution', () => {
    const input = { plan: 'growth', features: { reports: true }, modules: ['crm'], limits: { users: 7 } };
    expect(JSON.stringify(resolver.resolve(input))).toBe(JSON.stringify(resolver.resolve(input)));
  });

  it('unknown feature/module strings create no extra derived behavior', () => {
    const context = resolver.resolve({
      plan: 'x',
      features: { mystery: true },
      modules: ['mystery-module'],
    });
    // Stored verbatim but nothing is auto-enabled or inferred beyond what was given.
    expect(context.features.mystery).toBe(true);
    expect(context.modules['mystery-module']).toBe(true);
    expect(context.source).toBe('plan');
    expect(context.trialDays).toBe(30);
  });

  it('keeps the default profile conservative', () => {
    const context = resolver.resolve(null);
    expect(context.limits).toEqual({ users: 5, customers: 50, products: 50, storageGb: 1, aiCredits: 0 });
  });

  it('does not invent trialDays or limits beyond defaults for a plain plan', () => {
    const context = resolver.resolve({ plan: 'growth', limits: { users: 99 } });
    expect(context.trialDays).toBe(30);
    expect(context.limits.aiCredits).toBe(0);
    expect(context.limits.storageGb).toBe(1);
  });
});