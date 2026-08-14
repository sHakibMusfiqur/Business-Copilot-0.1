import { PrismaService } from '../prisma/prisma.service';

import { WorkspacePlanEntitlements } from './workspace-plan-entitlements';

type PlanSelect = {
  slug: string;
  modules: unknown;
  features: unknown;
  maxUsers: number | null;
  maxStorage: number | null;
  maxCustomers: number | null;
  maxProducts: number | null;
  aiCredits: number | null;
};

function buildProvider(subscription: unknown) {
  const prisma = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(subscription),
    },
  } as unknown as PrismaService;
  const provider = new WorkspacePlanEntitlements(prisma);
  return {
    provider,
    findUnique: prisma.subscription.findUnique as jest.Mock,
  };
}

function makePlan(overrides: Partial<PlanSelect> = {}): PlanSelect {
  return {
    slug: 'free',
    modules: ['invoicing', 'expenses'],
    features: { invoicing: true, expenses: true },
    maxUsers: 5,
    maxStorage: 512,
    maxCustomers: 50,
    maxProducts: 50,
    aiCredits: 0,
    ...overrides,
  };
}

function makeSubscription(status: string, plan: PlanSelect) {
  return { status, plan };
}

describe('WorkspacePlanEntitlements (tenant-scoped plan → entitlement bridge)', () => {
  it('returns the plan slug, modules, features and normalized limits for an active plan', async () => {
    const { provider, findUnique } = buildProvider(
      makeSubscription('ACTIVE', makePlan()),
    );

    const result = await provider.resolveForOrganization('org-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      plan: 'free',
      modules: ['expenses', 'invoicing'],
      features: { invoicing: true, expenses: true },
      limits: {
        users: 5,
        customers: 50,
        products: 50,
        storageGb: 512,
        aiCredits: 0,
      },
    });
  });

  it('includes crm when the plan allow-list contains crm', async () => {
    const { provider } = buildProvider(
      makeSubscription('ACTIVE', makePlan({ modules: ['invoicing', 'crm'] })),
    );

    const result = await provider.resolveForOrganization('org-1');

    expect(result?.modules).toContain('crm');
  });

  it('excludes crm when the plan allow-list does not contain crm', async () => {
    const { provider } = buildProvider(
      makeSubscription('ACTIVE', makePlan({ modules: ['invoicing', 'expenses'] })),
    );

    const result = await provider.resolveForOrganization('org-1');

    expect(result?.modules).not.toContain('crm');
  });

  it.each(['TRIALING', 'ACTIVE', 'PAST_DUE'])(
    'treats status %s as usable',
    async (status) => {
      const { provider } = buildProvider(makeSubscription(status, makePlan()));
      const result = await provider.resolveForOrganization('org-1');
      expect(result?.plan).toBe('free');
    },
  );

  it.each(['CANCELLED', 'EXPIRED'])(
    'returns undefined for a %s subscription',
    async (status) => {
      const { provider } = buildProvider(makeSubscription(status, makePlan()));
      const result = await provider.resolveForOrganization('org-1');
      expect(result).toBeUndefined();
    },
  );

  it('returns undefined when the organization has no subscription', async () => {
    const { provider } = buildProvider(null);
    const result = await provider.resolveForOrganization('org-9');
    expect(result).toBeUndefined();
  });

  it('queries only by organizationId (tenant-scoped, never from request data)', async () => {
    const { provider, findUnique } = buildProvider(
      makeSubscription('ACTIVE', makePlan({ modules: ['crm'] })),
    );

    await provider.resolveForOrganization('org-7');

    const args = findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: 'org-7' });
    expect(Object.keys(args.where)).toEqual(['organizationId']);
  });

  it('returns undefined when the subscription has no linked plan', async () => {
    const { provider } = buildProvider({ status: 'ACTIVE', plan: null });
    const result = await provider.resolveForOrganization('org-1');
    expect(result).toBeUndefined();
  });

  it('normalizes a record-shaped modules JSON into the string[] allow-list', async () => {
    const { provider } = buildProvider(
      makeSubscription('ACTIVE', makePlan({ modules: { crm: true, invoicing: false } })),
    );

    const result = await provider.resolveForOrganization('org-1');

    expect(result?.modules).toEqual(['crm']);
  });

  it('ignores non-string module entries instead of inventing names', async () => {
    const { provider } = buildProvider(
      makeSubscription('ACTIVE', makePlan({ modules: ['crm', 42, null] })),
    );

    const result = await provider.resolveForOrganization('org-1');

    expect(result?.modules).toEqual(['crm']);
  });

  it('leaves matching feature flags as booleans and drops absent limits', async () => {
    const { provider } = buildProvider(
      makeSubscription(
        'ACTIVE',
        makePlan({
          features: { reports: true, ai: false },
          aiCredits: null,
          maxUsers: null,
        }),
      ),
    );

    const result = await provider.resolveForOrganization('org-1');

    expect(result?.features).toEqual({ reports: true, ai: false });
    expect(result?.limits).toEqual({
      customers: 50,
      products: 50,
      storageGb: 512,
    });
  });
});