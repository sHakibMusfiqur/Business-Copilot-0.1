import { ProvisioningProgressService } from './provisioning-progress.service';

type Status = 'PENDING' | 'PROVISIONING' | 'COMPLETED' | 'FAILED';

/** In-memory stand-in for the onboardingSession table; updateMany enforces NOT IN ('COMPLETED','FAILED') at the DB boundary. */
function buildBackstop(initialStatus: Status, provisionData: Record<string, unknown> | null = null) {
  const persisted: { status: Status; data: Record<string, unknown> | null } = {
    status: initialStatus,
    data: provisionData,
  };
  const prisma: {
    onboardingSession: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  } = {
    onboardingSession: {
      findUnique: jest.fn(async () => ({
        id: 'session-1',
        provisionStatus: persisted.status,
        provisionData: persisted.data,
      })),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        persisted.status = (data.provisionStatus as Status) ?? persisted.status;
        persisted.data = { ...persisted.data, ...(data.provisionData as Record<string, unknown>) };
        return { id: where.id, provisionStatus: persisted.status, provisionData: persisted.data };
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const notIn = (where.provisionStatus as { notIn?: Status[] } | undefined)?.notIn;
          if (notIn && notIn.includes(persisted.status)) return { count: 0 };
          persisted.data = { ...persisted.data, ...(data.provisionData as Record<string, unknown>) };
          return { count: 1 };
        },
      ),
    },
  };
  return { prisma, persisted };
}

const service = (backstop: ReturnType<typeof buildBackstop>) =>
  new ProvisioningProgressService(backstop.prisma as never);

describe('ProvisioningProgressService persistence semantics', () => {
  it('persists a genuine intermediate progress observation while still PROVISIONING', async () => {
    const backstop = buildBackstop('PROVISIONING');
    const progress = service(backstop);

    await progress.updateProgress('session-1', 30, 'Creating owner role...', ['Organization', 'Owner']);

    const observed = await progress.getProgress('session-1');
    expect(observed?.status).toBe('PROVISIONING');
    expect(observed?.progress).toBe(30);
    expect(observed?.currentTask).toBe('Creating owner role...');
  });

  it('getProgress() returns the persisted intermediate progress (polling fallback)', async () => {
    const backstop = buildBackstop('PROVISIONING');
    const progress = service(backstop);

    await progress.updateProgress('session-1', 45, 'Configuring departments...', ['Organization', 'Owner', 'Roles']);

    const observed = await progress.getProgress('session-1');
    expect(observed?.progress).toBe(45);
    expect(observed?.currentTask).toBe('Configuring departments...');
    expect(observed?.status).toBe('PROVISIONING');
  });

  it('COMPLETED cannot be overwritten by an intermediate progress write (atomic guard)', async () => {
    const backstop = buildBackstop('COMPLETED', {
      progress: 100,
      currentTask: 'Complete',
      completedTasks: [],
    });
    const progress = service(backstop);

    await progress.updateProgress('session-1', 45, 'Configuring departments...', ['Organization']);

    const observed = await progress.getProgress('session-1');
    expect(observed?.status).toBe('COMPLETED');
    expect(observed?.progress).toBe(100);
    expect(backstop.prisma.onboardingSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ provisionStatus: { notIn: ['COMPLETED', 'FAILED'] } }),
      }),
    );
  });

  it('FAILED remains FAILED and is not overwritten by an intermediate progress write (atomic guard)', async () => {
    const backstop = buildBackstop('FAILED', {
      failedTask: 'Applying industry settings...',
      error: 'boom',
      progress: 0,
    });
    const progress = service(backstop);

    await progress.updateProgress('session-1', 95, 'Industry lifecycle...', ['Organization', 'Owner']);

    const observed = await progress.getProgress('session-1');
    expect(observed?.status).toBe('FAILED');
    expect(observed?.progress).toBe(0);
    expect(observed?.failedTask).toBe('Applying industry settings...');
  });

  it('race: an intermediate progress write concurrent with COMPLETED is dropped at the DB boundary', async () => {
    const backstop = buildBackstop('PROVISIONING');
    const progress = service(backstop);

    // markCompleted wins the race: once COMPLETED, the guard updates 0 rows.
    const [writeResult, completeResult] = await Promise.all([
      (async () => {
        await new Promise((r) => setTimeout(r, 5));
        await progress.updateProgress('session-1', 30, 'Creating owner role...', ['Organization']);
        return 'written';
      })(),
      (async () => {
        await new Promise((r) => setTimeout(r, 0));
        await progress.markCompleted('session-1', 'org-1', null);
        return 'completed';
      })(),
    ]);

    const observed = await progress.getProgress('session-1');
    expect(writeResult).toBe('written');
    expect(completeResult).toBe('completed');
    expect(observed?.status).toBe('COMPLETED');
    expect(observed?.progress).toBe(100);
    expect(observed?.currentTask).toBe('Complete');
  });
});