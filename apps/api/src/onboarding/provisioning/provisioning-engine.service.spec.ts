import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ProvisioningEngineService } from './provisioning-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { IndustryTemplateFactory } from '../industry-templates/industry-template.factory';

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    email: 'user@x.com',
    name: 'User',
    userId: 'user-1',
    provisionStatus: 'PENDING',
    selectedIndustry: 'retail',
    orgName: 'Acme Inc',
    provisionData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProvisioningEngineService (bound-user requirement)', () => {
  const dispatcher = {
    dispatch: jest.fn().mockResolvedValue({ success: true, result: { org: { id: 'org-1' }, subscription: null } }),
  };
  const progress = {
    markCompleted: jest.fn().mockResolvedValue({}),
    markFailed: jest.fn().mockResolvedValue({}),
    getProgress: jest.fn().mockResolvedValue(null),
  };
  const metrics = {
    recordSessionStart: jest.fn(),
    recordSessionComplete: jest.fn(),
    recordSessionFailed: jest.fn(),
  };
  const compensation = { clear: jest.fn(), rollback: jest.fn() };
  const checklist = { initChecklist: jest.fn().mockResolvedValue([]) };
  const industryFactory = {
    getProvisioningConfig: jest.fn().mockReturnValue({ departments: [] }),
    getProvider: jest.fn().mockReturnValue(null),
  };

  function buildEngine(session: Record<string, unknown>, owner: Record<string, unknown> = { organizationId: null, emailVerified: true }) {
    const prisma = {
      onboardingSession: {
        findUnique: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(owner),
      },
    };
    const engine = new ProvisioningEngineService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
      dispatcher as never,
      progress as never,
      metrics as never,
      compensation as never,
      checklist as never,
      industryFactory as unknown as IndustryTemplateFactory,
    );
    return { engine, prisma };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects provisioning when the session has no bound user', async () => {
    const session = buildSession({ userId: null });
    const { engine } = buildEngine(session);

    await expect(engine.provision('session-1')).rejects.toThrow(BadRequestException);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('rejects provisioning for an unverified owner before dispatching tasks', async () => {
    const { engine, prisma } = buildEngine(
      buildSession(),
      { organizationId: null, emailVerified: false },
    );

    await expect(engine.provision('session-1')).rejects.toThrow(ForbiddenException);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(prisma.onboardingSession.update).not.toHaveBeenCalled();
  });

  it('allows provisioning when the session is bound to a user', async () => {
    const { engine, prisma } = buildEngine(buildSession());

    const result = await engine.provision('session-1');

    expect(dispatcher.dispatch).toHaveBeenCalledWith('session-1');
    expect(progress.markCompleted).toHaveBeenCalledWith('session-1', 'org-1', null);
    expect(prisma.onboardingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ provisionStatus: 'PROVISIONING' }) }),
    );
    expect(result).toBeDefined();
  });

  it('rejects a second organization for a user that already belongs to one', async () => {
    const { engine, prisma } = buildEngine(
      buildSession(),
      { organizationId: 'org-existing', emailVerified: true },
    );

    await expect(engine.provision('session-1')).rejects.toThrow(ConflictException);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(prisma.onboardingSession.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ provisionStatus: 'PROVISIONING' }) }),
    );
  });

  it('allows resuming when the session is bound to the user\u2019s own org', async () => {
    (progress.getProgress as jest.Mock).mockResolvedValueOnce({ failedTask: 'DoConfigureDepartments' });
    const { engine } = buildEngine(
      buildSession({ provisionStatus: 'PROVISIONING', organizationId: 'org-1' }),
      { organizationId: 'org-1', emailVerified: true },
    );

    await expect(engine.provision('session-1')).resolves.toBeDefined();
    expect(dispatcher.dispatch).toHaveBeenCalledWith('session-1');
  });

  it('rethrows a domain ConflictException from the dispatcher and marks the session failed', async () => {
    (dispatcher.dispatch as jest.Mock).mockRejectedValueOnce(
      new ConflictException('This account already belongs to an organization and cannot provision another one'),
    );
    const { engine } = buildEngine(buildSession());

    await expect(engine.provision('session-1')).rejects.toThrow(ConflictException);
    expect(progress.markFailed).toHaveBeenCalled();
    expect(compensation.rollback).toHaveBeenCalledWith('session-1');
  });
});
