import { ConflictException } from '@nestjs/common';
import { ProvisioningExecutorService } from './provisioning-executor.service';
import { ProvisioningProgressService } from './provisioning-progress.service';
import { ProvisioningEngineService } from './provisioning-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { IndustryTemplateFactory } from '../industry-templates/industry-template.factory';

const emptyConfig = {
  departments: [],
  roles: [],
  chartOfAccounts: [],
  inventoryCategories: [],
  approvalWorkflows: [],
  dashboardWidgets: [],
} as const;

function pendingReadSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1', email: 'u@x.com', name: 'U', userId: 'user-1',
    provisionStatus: 'PENDING', provisionData: null,
    selectedIndustry: 'retail', orgName: 'Acme Inc', organizationId: null,
    currentStep: 7, completedSteps: [], version: 7,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * A shared Prisma-like repository backstop used ONLY by the test.
 *
 * `findUnique` returns a fixed "read snapshot" for the onboarding session (two
 * concurrent requests both observe the same state they read before any write
 * committed), while `update`/`updateMany` atomically mutate the persisted
 * terminal state exactly like the real repository:
 *
 * - `update` (markCompleted) applies unconditionally.
 * - `updateMany` honours the `provisionStatus != COMPLETED` guard and returns
 *   count 0 when the session is already COMPLETED, so FAILED never regresses
 *   COMPLETED (matching the real ProvisioningProgressService fix).
 */
function createSharedPrisma(
  readSession: Record<string, unknown>,
  options: { boundOrgId?: string | null } = {},
) {
  const persisted: { provisionStatus: string; organizationId: string | null } = {
    provisionStatus: readSession.provisionStatus as string,
    organizationId: (readSession.organizationId as string | null) ?? null,
  };
  const boundOrgId = options.boundOrgId !== undefined ? options.boundOrgId : persisted.organizationId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    onboardingSession: {
      findUnique: async () => readSession,
      update: async () => { /* markCompleted writes via update/data handled below */ return readSession; },
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const notCompleted = (where.provisionStatus as { not?: string } | undefined)?.not === 'COMPLETED';
        if (notCompleted && persisted.provisionStatus === 'COMPLETED') return { count: 0 };
        if (data.provisionStatus !== undefined) persisted.provisionStatus = data.provisionStatus as string;
        if (data.organizationId !== undefined) persisted.organizationId = data.organizationId as string | null;
        return { count: 1 };
      }),
    },
    organization: { findUnique: async ({ where }: { where: { id: string } }) =>
      persisted.organizationId !== null && where.id === persisted.organizationId ? { id: where.id } : null },
    user: { findUnique: async () => ({ organizationId: boundOrgId, emailVerified: true }) },
    subscription: { findUnique: async () => null },
  };
  // markCompleted path goes through prisma.onboardingSession.update; wire it to
  // mutate persisted so COMPLETED actually persists.
  prisma.onboardingSession.update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (data.provisionStatus !== undefined) persisted.provisionStatus = data.provisionStatus as string;
    if (data.organizationId !== undefined) persisted.organizationId = data.organizationId as string | null;
    return readSession;
  });

  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const metrics = { recordSessionStart: jest.fn(), recordSessionComplete: jest.fn(), recordSessionFailed: jest.fn() };
  const compensation = { clear: jest.fn(), rollback: jest.fn() };
  const checklist = { initChecklist: jest.fn().mockResolvedValue([]) };
  const industryFactory = {
    getProvisioningConfig: jest.fn().mockReturnValue({ departments: [] }),
    getProvider: jest.fn().mockReturnValue(null),
  };

  function buildEngine(dispatcherFn: () => Promise<unknown>) {
    const progress = new ProvisioningProgressService(prisma);
    const dispatcher = { dispatch: dispatcherFn };
    const engine = new ProvisioningEngineService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      dispatcher as never,
      progress as never,
      metrics as never,
      compensation as never,
      checklist as never,
      industryFactory as unknown as IndustryTemplateFactory,
    );
    return { engine, progress, audit, metrics, compensation };
  }

  return { prisma, persisted, buildEngine, status: () => persisted.provisionStatus };
}

describe('Provisioning concurrency & recovery (fixes validated on real production methods)', () => {
  it('4A. atomic claim: exactly one of two concurrent provisions of the same user claims the org', async () => {
    const users: { id: string; organizationId: string | null }[] = [{ id: 'user-1', organizationId: null }];
    const orgs: { id: string; name: string }[] = [];
    const members: { organizationId: string; userId: string; role: string }[] = [];

    const claim = (userId: string, orgId: string): { count: number } => {
      const u = users.find((x) => x.id === userId);
      if (!u) return { count: 0 };
      if (u.organizationId === null || u.organizationId === orgId) {
        u.organizationId = orgId;
        return { count: 1 };
      }
      return { count: 0 };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx: any = {
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) => orgs.find((o) => o.id === where.id) ?? null,
        create: async ({ data }: { data: { name: string } }) => {
          const org = { id: `org-${orgs.length + 1}`, name: data.name };
          orgs.push(org);
          return org;
        },
      },
      onboardingSession: { update: async () => ({}) },
      user: { updateMany: async ({ where, data }: { where: { id: string }; data: { organizationId: string } }) => claim(where.id, data.organizationId) },
      organizationMember: {
        findFirst: async () => null,
        create: async ({ data }: { data: { organizationId: string; userId: string; role: string } }) => { members.push(data); return data; },
      },
      permission: { findMany: async () => [] },
      role: { findFirst: async () => null, create: async () => ({ id: 'role-1' }) },
      rolePermission: { createMany: async () => ({}) },
      userRoleAssignment: { findFirst: async () => null, create: async () => ({}) },
      department: { createMany: async () => ({}) },
      subscription: { findUnique: async () => null },
      subscriptionPlan: { findUnique: async () => null },
      organizationSettings: { upsert: async () => ({}) },
    };

    const service = new ProvisioningExecutorService({} as never);
    const results = await Promise.allSettled([
      service.executeCheckpoint(
        { id: 's1', userId: 'user-1', orgName: 'Acme Inc', organizationId: null, selectedModules: [] },
        emptyConfig as never, 1, tx,
      ),
      service.executeCheckpoint(
        { id: 's2', userId: 'user-1', orgName: 'Beta Ltd', organizationId: null, selectedModules: [] },
        emptyConfig as never, 1, tx,
      ),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(users[0].organizationId).not.toBeNull();
    expect(members).toHaveLength(1);
  });

  it('4B. recovery: stranded PROVISIONING with a committed, consistent org finalizes to COMPLETED without re-running', async () => {
    const { persisted, buildEngine, status } = createSharedPrisma(
      pendingReadSession({ provisionStatus: 'PROVISIONING', organizationId: 'org-1', provisionData: null }),
      { boundOrgId: 'org-1' },
    );
    persisted.organizationId = 'org-1';

    const { engine, compensation } = buildEngine((async () => {
      throw new Error('dispatch must NOT run during recovery');
    }) as never);
    (compensation.rollback as jest.Mock).mockResolvedValue(undefined);

    await expect(engine.provision('session-1')).resolves.toBeDefined();

    expect(status()).toBe('COMPLETED');
    expect(persisted.organizationId).toBe('org-1');
  });

  it('4B. negative: inconsistent committed state (user bound to a different org) is never marked COMPLETED', async () => {
    const { persisted, buildEngine, status } = createSharedPrisma(
      pendingReadSession({ provisionStatus: 'PROVISIONING', organizationId: 'org-1', provisionData: null }),
      { boundOrgId: 'org-OTHER' }, // user belongs to a different org -> inconsistent
    );
    persisted.organizationId = 'org-1';

    const { engine } = buildEngine((async () => {
      throw new Error('must not dispatch');
    }) as never);

    await expect(engine.provision('session-1')).rejects.toThrow('Provisioning already in progress');
    expect(status()).toBe('PROVISIONING');
    expect(status()).not.toBe('COMPLETED');
  });

  it('4B. negative: PROVISIONING without a committed organization is never marked COMPLETED', async () => {
    const { persisted, buildEngine, status } = createSharedPrisma(
      pendingReadSession({ provisionStatus: 'PROVISIONING', organizationId: null, provisionData: null }),
      { boundOrgId: null },
    );
    persisted.organizationId = null;

    const { engine } = buildEngine((async () => {
      throw new Error('must not dispatch');
    }) as never);

    await expect(engine.provision('session-1')).rejects.toThrow('Provisioning already in progress');
    expect(status()).toBe('PROVISIONING');
    expect(status()).not.toBe('COMPLETED');
  });

  it('Fix 2 (guard): markFailed cannot regress an already-COMPLETED session to FAILED', async () => {
    const { persisted, prisma, buildEngine } = createSharedPrisma(
      pendingReadSession({ provisionStatus: 'COMPLETED', organizationId: 'org-1' }),
      { boundOrgId: 'org-1' },
    );
    persisted.provisionStatus = 'COMPLETED';
    const { progress } = buildEngine((async () => ({ success: true as const, result: { org: { id: 'org-1' }, subscription: null } })) as never);

    await progress.markFailed('session-1', 'provisioning', 'boom');

    expect(persisted.provisionStatus).toBe('COMPLETED');
    expect((prisma.onboardingSession.updateMany as jest.Mock).mock.calls[0][0].where).toEqual({
      id: 'session-1',
      provisionStatus: { not: 'COMPLETED' },
    });
  });

  it('Fix 2 (guard): markFailed still marks a non-COMPLETED session as FAILED', async () => {
    const { persisted, buildEngine } = createSharedPrisma(pendingReadSession({ provisionStatus: 'PROVISIONING' }), { boundOrgId: null });
    persisted.provisionStatus = 'PROVISIONING';
    const { progress } = buildEngine((async () => ({ success: true as const, result: { org: { id: 'org-1' }, subscription: null } })) as never);

    await progress.markFailed('session-1', 'provisioning', 'boom');

    expect(persisted.provisionStatus).toBe('FAILED');
  });

  it('4A. a losing concurrent request cannot change COMPLETED -> FAILED (real engine + real progress)', async () => {
    const { buildEngine, status } = createSharedPrisma(pendingReadSession());

    const winner = buildEngine((async () => ({ success: true as const, result: { org: { id: 'org-1' }, subscription: null } })) as never);

    // Loser's dispatch is gated: it reads PENDING, writes PROVISIONING, then
    // suspends at dispatch. The winner completes first (COMPLETED); only then
    // does the loser's dispatch reject (atomic-claim conflict), driving it into
    // the failure handler whose markFailed must not regress COMPLETED.
    let releaseLoser!: () => void;
    const loserGate = new Promise<void>((resolve) => { releaseLoser = resolve; });
    const loser = buildEngine((async () => {
      await loserGate;
      throw new ConflictException('This account already belongs to an organization and cannot provision another one');
    }) as never);

    const loserP = loser.engine.provision('session-1');

    await winner.engine.provision('session-1');
    expect(status()).toBe('COMPLETED');

    releaseLoser();
    await expect(loserP).rejects.toThrow(ConflictException);

    // The losing request has run its failure handler against a COMPLETED
    // session, yet the terminal state is preserved.
    expect(status()).toBe('COMPLETED');
  });
});