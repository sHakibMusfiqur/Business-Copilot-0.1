import { ProvisioningOrchestratorService } from './provisioning-orchestrator.service';

function buildMocks() {
  const eventBus = { publish: jest.fn() };
  const executor = {
    executeCheckpoint: jest.fn().mockResolvedValue({
      success: true,
      checkpoint: 7,
      task: 'Complete',
      tasks: [],
      result: undefined,
    }),
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
  return {
    eventBus,
    executor,
    prisma,
    retryService,
    industryFactory,
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
      expect.anything(), expect.anything(), 4, expect.anything(),
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
      expect.anything(), expect.anything(), 0, expect.anything(),
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
      expect.anything(), expect.anything(), 1, expect.anything(),
    );
  });
});
