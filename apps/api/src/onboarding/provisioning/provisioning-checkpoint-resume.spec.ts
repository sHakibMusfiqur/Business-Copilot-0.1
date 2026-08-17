import { ProvisioningEngineService } from './provisioning-engine.service';
import { ProvisioningProgressService } from './provisioning-progress.service';
import { ProvisioningExecutorService } from './provisioning-executor.service';
import { ProvisioningOrchestratorService } from './provisioning-orchestrator.service';
import { ImmediateExecutionDispatcher } from './immediate-execution-dispatcher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { IndustryTemplateFactory } from '../industry-templates/industry-template.factory';

function readSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1', email: 'u@x.com', name: 'U', userId: 'user-1',
    provisionStatus: 'PENDING', provisionData: null,
    selectedIndustry: 'retail', orgName: 'Acme Inc', organizationId: null,
    selectedModules: [], selectedPlanId: null,
    currentStep: 7, completedSteps: [], version: 7,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}


function createBackstop(
  readSession: Record<string, unknown>,
  options: { boundOrgId?: string | null; failAt?: 'applySettings' | null } = {},
) {
  const persisted: {
    provisionStatus: string;
    organizationId: string | null;
    provisionData: Record<string, unknown> | null;
  } = {
    provisionStatus: readSession.provisionStatus as string,
    organizationId: (readSession.organizationId as string | null) ?? null,
    provisionData: (readSession.provisionData as Record<string, unknown> | null) ?? null,
  };
  const boundOrgId = options.boundOrgId !== undefined ? options.boundOrgId : persisted.organizationId;
  const failAtRef = { value: options.failAt ?? null };

  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const metrics = {
    recordSessionStart: jest.fn(), recordSessionComplete: jest.fn(),
    recordSessionFailed: jest.fn(), recordRetry: jest.fn(),
  };
  const compensation = { clear: jest.fn(), rollback: jest.fn().mockResolvedValue(undefined) };
  const checklist = { initChecklist: jest.fn().mockResolvedValue([]) };
  const industryFactory = {
    getProvisioningConfig: jest.fn().mockReturnValue({ departments: [] }),
    getProvider: jest.fn().mockReturnValue(null),
  };
  const eventBus = { publish: jest.fn() };
  const retryService = {
    execute: jest.fn(async (op: () => Promise<unknown>) => ({ result: await op(), retryCount: 0 })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    onboardingSession: {
      findUnique: jest.fn(async () => ({
        ...readSession,
        provisionStatus: persisted.provisionStatus,
        organizationId: persisted.organizationId,
        provisionData: persisted.provisionData,
      })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (data.provisionStatus !== undefined) persisted.provisionStatus = data.provisionStatus as string;
        if (data.organizationId !== undefined) persisted.organizationId = data.organizationId as string | null;
        if (data.provisionData !== undefined) persisted.provisionData = data.provisionData as Record<string, unknown>;
        return { ...readSession, ...data };
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const notCompleted = (where.provisionStatus as { not?: string } | undefined)?.not === 'COMPLETED';
        if (notCompleted && persisted.provisionStatus === 'COMPLETED') return { count: 0 };
        if (data.provisionStatus !== undefined) persisted.provisionStatus = data.provisionStatus as string;
        if (data.organizationId !== undefined) persisted.organizationId = data.organizationId as string | null;
        if (data.provisionData !== undefined) persisted.provisionData = data.provisionData as Record<string, unknown>;
        return { count: 1 };
      }),
    },
    organization: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string } }) =>
        persisted.organizationId !== null && where.id === persisted.organizationId ? { id: where.id } : null),
      create: jest.fn(async ({ data }: { data: { name: string } }) => ({ id: 'org-1', name: data.name })),
    },
    user: {
      findUnique: jest.fn(async () => ({ organizationId: boundOrgId })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    organizationMember: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    permission: { findMany: jest.fn(async () => []) },
    role: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'role-1', ...data })),
    },
    rolePermission: { createMany: jest.fn(async () => ({})) },
    userRoleAssignment: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    department: { createMany: jest.fn(async () => ({})) },
    subscription: { findUnique: jest.fn(async () => null) },
    subscriptionPlan: { findUnique: jest.fn(async () => null) },
    organizationSettings: {
      upsert: jest.fn(async () => {
        if (failAtRef.value === 'applySettings') throw new Error('Simulated transient DB failure');
        return {};
      }),
    },
    $transaction: jest.fn(async (fn: (tx: never) => Promise<unknown>) => fn(prisma as never)),
  };

  const progress = new ProvisioningProgressService(prisma);
  const executor = new ProvisioningExecutorService(industryFactory as unknown as IndustryTemplateFactory);
  const orchestrator = new ProvisioningOrchestratorService(
    prisma as never, audit as never, executor as never,
    eventBus as never, retryService as never, industryFactory as never,
    progress as never,
  );
  const dispatcher = new ImmediateExecutionDispatcher(orchestrator);
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

  return { prisma, persisted, engine, progress, compensation, audit, executor, failAtRef };
}

describe('Provisioning checkpoint resume (G1)', () => {
  it('persists the real failing checkpoint id (not "provisioning") on a mid-pipeline failure', async () => {
    const { persisted, engine, compensation, prisma, audit } = createBackstop(
      readSession(),
      { failAt: 'applySettings' },
    );

    await expect(engine.provision('session-1')).rejects.toThrow('Simulated transient DB failure');

    expect(prisma.organization.create).toHaveBeenCalled();
    expect(prisma.organizationSettings.upsert).toHaveBeenCalled();
    expect(persisted.provisionStatus).toBe('FAILED');
    expect((persisted.provisionData as { failedTask?: string }).failedTask).toBe('Applying industry settings...');
    expect((persisted.provisionData as { failedTask?: string }).failedTask).not.toBe('provisioning');
    expect(compensation.rollback).toHaveBeenCalledWith('session-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROVISION_FAILED', status: 'FAILURE' }),
    );
  });

  it('keeps Phase 4 recovery intact: stranded PROVISIONING with a committed org finalizes to COMPLETED without dispatch', async () => {
    const { persisted, engine, prisma } = createBackstop(
      readSession({ provisionStatus: 'PROVISIONING', organizationId: 'org-1' }),
      { boundOrgId: 'org-1' },
    );
    persisted.organizationId = 'org-1';

    await expect(engine.provision('session-1')).resolves.toBeDefined();

    expect(persisted.provisionStatus).toBe('COMPLETED');
    expect(persisted.organizationId).toBe('org-1');
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('after a recorded mid-pipeline failure (org rolled back), a retry full re-runs instead of resuming to a broken state', async () => {
    const { persisted, engine, failAtRef, prisma, compensation } = createBackstop(
      readSession(),
      { failAt: 'applySettings' },
    );

    await expect(engine.provision('session-1')).rejects.toThrow('Simulated transient DB failure');
    expect((persisted.provisionData as { failedTask?: string }).failedTask).toBe('Applying industry settings...');

  
    persisted.organizationId = null;
    failAtRef.value = null;
    const createCalls = (prisma.organization.create as jest.Mock).mock.calls.length;
    const rollbackCalls = (compensation.rollback as jest.Mock).mock.calls.length;

    await expect(engine.provision('session-1')).resolves.toBeDefined();

    expect(persisted.provisionStatus).toBe('COMPLETED');
    expect((prisma.organization.create as jest.Mock).mock.calls.length).toBeGreaterThan(createCalls);
    expect((compensation.rollback as jest.Mock).mock.calls.length).toBe(rollbackCalls);
  });
});
