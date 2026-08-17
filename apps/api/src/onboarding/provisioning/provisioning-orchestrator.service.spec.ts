import { ProvisioningOrchestratorService } from './provisioning-orchestrator.service';
import { CHECKPOINT_TASKS } from './provisioning-checkpoints';

function buildMocks() {
  const eventBus = { publish: jest.fn() };
  const executor = {
    executeCheckpoint: jest.fn().mockImplementation(
      async (
        _session: Record<string, unknown>,
        _config: unknown,
        _startCheckpoint: number,
        _tx: unknown,
        onCheckpoint?: (o: { task: string; progress: number; completedTasks: string[] }) => void | Promise<void>,
      ) => {
        if (onCheckpoint) {
          for (const c of CHECKPOINT_TASKS) {
            await onCheckpoint({ task: c.task, progress: c.progress, completedTasks: [] });
          }
        }
        return {
          success: true,
          checkpoint: 7,
          task: 'Complete',
          tasks: [],
          result: undefined,
        };
      },
    ),
  };
  const prisma: {
    onboardingSession: { findUnique: jest.Mock };
    organization: { findUnique: jest.Mock; findFirst: jest.Mock };
    subscription: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  } = {
    onboardingSession: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn(), findFirst: jest.fn() },
    subscription: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: never) => Promise<unknown>) =>
    fn(prisma as never),
  );
  const retryService = {
    execute: jest.fn((op: () => Promise<unknown>) =>
      op().then((result) => ({ result, retryCount: 0 })),
    ),
  };
  const industryFactory = {
    getProvisioningConfig: jest.fn().mockReturnValue({}),
    getProvider: jest.fn().mockReturnValue(null),
  };
  const progress = { updateProgress: jest.fn().mockResolvedValue(undefined) };
  return {
    eventBus,
    executor,
    prisma,
    retryService,
    industryFactory,
    progress,
    audit: { record: jest.fn() },
  };
}

function buildService(mocks: ReturnType<typeof buildMocks>) {
  return new ProvisioningOrchestratorService(
    mocks.prisma as never,
    mocks.audit as never,
    mocks.executor as never,
    mocks.eventBus as never,
    mocks.retryService as never,
    mocks.industryFactory as never,
    mocks.progress as never,
  );
}

describe('ProvisioningOrchestratorService', () => {
  it('never falls back to the latest org when the session has no organizationId', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: null,
    });
    const service = buildService(mocks);

    await expect(service.orchestrate('session-1')).rejects.toThrow(
      'Organization not created during transaction',
    );
    expect(mocks.prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('builds the result from the session\u2019s own organization', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: 'org-1',
    });
    mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    const service = buildService(mocks);

    await expect(service.orchestrate('session-1')).resolves.toEqual({
      org: { id: 'org-1' },
      subscription: null,
    });
    expect(mocks.prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('resumes at the checkpoint matching a recorded failedTask (startCheckpoint = index + 1)', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: 'org-1',
      provisionData: { failedTask: 'Configuring departments...' },
    });
    mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    const service = buildService(mocks);

    await service.orchestrate('session-1');

    expect(mocks.executor.executeCheckpoint).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 4, expect.anything(), expect.anything(),
    );
  });

  it('falls back to a full re-run (startCheckpoint 0) for an unrecognized failedTask', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: 'org-1',
      provisionData: { failedTask: 'not-a-real-checkpoint' },
    });
    mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    const service = buildService(mocks);

    await service.orchestrate('session-1');

    expect(mocks.executor.executeCheckpoint).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 0, expect.anything(), expect.anything(),
    );
  });

  it('falls back to a full re-run (startCheckpoint 1) when the failedTask was recorded but the org was rolled back', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: null,
      provisionData: { failedTask: 'Configuring departments...' },
    });
    const service = buildService(mocks);

    await expect(service.orchestrate('session-1')).rejects.toThrow(
      'Organization not created during transaction',
    );
    expect(mocks.executor.executeCheckpoint).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 1, expect.anything(), expect.anything(),
    );
  });

  it('still emits every checkpoint progress event on the event bus (SSE preserved)', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: 'org-1',
    });
    mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    mocks.executor.executeCheckpoint.mockResolvedValue({
      success: true, checkpoint: 7, task: 'Complete',
      tasks: ['Organization', 'Owner', 'Roles', 'Departments', 'Subscription', 'Settings', 'Industry'],
      result: undefined,
    });
    const service = buildService(mocks);

    await service.orchestrate('session-1');

    const progressEvents = (mocks.eventBus.publish as jest.Mock).mock.calls
      .filter(([e]) => e.type === 'progress');
    expect(progressEvents.length).toBe(7);
    expect(progressEvents[0][0].data.currentTask).toBe('Creating organization...');
    expect(progressEvents[6][0].data.progress).toBe(95);
  });

  it('persists each completed checkpoint observation during provisioning', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: 'org-1',
    });
    mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    const service = buildService(mocks);

    await service.orchestrate('session-1');

    const calls = (mocks.progress.updateProgress as jest.Mock).mock.calls;
    expect(calls.length).toBe(CHECKPOINT_TASKS.length);
    expect(calls[0]).toEqual(['session-1', 5, 'Creating organization...', []]);
    expect(calls[3]).toEqual(['session-1', 45, 'Configuring departments...', []]);
    expect(calls[calls.length - 1]).toEqual(['session-1', 95, 'Industry lifecycle...', []]);
  });

  it('does not fail provisioning when the observational progress write fails', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: 'org-1',
    });
    mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    mocks.progress.updateProgress = jest.fn().mockRejectedValue(new Error('telemetry down'));
    const service = buildService(mocks);

    await expect(service.orchestrate('session-1')).resolves.toEqual({
      org: { id: 'org-1' },
      subscription: null,
    });
  });

  it('persists checkpoint observations only after the transaction commits (no root-client writes inside it)', async () => {
    const mocks = buildMocks();
    mocks.prisma.onboardingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      email: 'a@b.com',
      organizationId: 'org-1',
    });
    mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    let insideTx = false;
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: never) => Promise<unknown>) => {
      insideTx = true;
      try {
        return await fn(mocks.prisma as never);
      } finally {
        insideTx = false;
      }
    });
    mocks.progress.updateProgress.mockImplementation(() => {
      if (insideTx) throw new Error('progress persisted inside the transaction');
      return Promise.resolve();
    });
    const service = buildService(mocks);

    await expect(service.orchestrate('session-1')).resolves.toEqual({
      org: { id: 'org-1' },
      subscription: null,
    });
    expect(mocks.progress.updateProgress).toHaveBeenCalled();
  });
});
