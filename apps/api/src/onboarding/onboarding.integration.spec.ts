import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { OnboardingService } from './onboarding.service';
import { IdempotencyService } from './services/idempotency.service';
import { OnboardingChecklistService } from './services/onboarding-checklist.service';
import { OnboardingMetricsService } from './services/onboarding-metrics.service';
import { OnboardingCleanupService } from './services/onboarding-cleanup.service';
import { LocalEventBus } from './provisioning/local-event-bus.service';
import { PROVISION_EVENT_BUS } from './provisioning/provision-event-bus.interface';
import { ImmediateExecutionDispatcher } from './provisioning/immediate-execution-dispatcher.service';
import { ProvisioningRetryService } from './provisioning/provisioning-retry.service';
import { ProvisioningOrchestratorService } from './provisioning/provisioning-orchestrator.service';
import { EventBusFactory } from './provisioning/event-bus-factory.service';
import { DispatcherFactory } from './provisioning/dispatcher-factory.service';
import { MemoryExporter } from './services/memory-exporter.service';
import { isTransientError } from './provisioning/retry-policy';
import { SessionConflictError } from './errors/session-conflict.error';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { IndustryTemplateFactory } from './industry-templates/industry-template.factory';

const mockPrisma = {
  onboardingSession: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  idempotencyRecord: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  checklistItem: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  organization: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  user: { update: jest.fn() },
  organizationMember: { findFirst: jest.fn(), create: jest.fn() },
  role: { create: jest.fn() },
  permission: { findMany: jest.fn().mockResolvedValue([]) },
  rolePermission: { createMany: jest.fn() },
  userRoleAssignment: { create: jest.fn() },
  department: { create: jest.fn() },
  subscriptionPlan: { findUnique: jest.fn() },
  organizationSettings: { create: jest.fn() },
  auditLog: { findFirst: jest.fn() },
  $transaction: jest.fn(),
  $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  $queryRaw: jest.fn().mockResolvedValue([1]),
};

const mockAuditService = { record: jest.fn() };

const mockJwtService = {
  sign: jest.fn().mockReturnValue('onboarding-token'),
};

const mockConfigService = {
  jwtSecret: 'test-secret',
};

const mockIndustryFactory = {
  getAllTemplates: jest.fn().mockReturnValue([]),
  getProvisioningConfig: jest.fn().mockReturnValue({
    departments: [],
    roles: [],
    chartOfAccounts: [],
    dashboardWidgets: [],
  }),
  getProvider: jest.fn().mockReturnValue(null),
};

const mockOrchestrator = {
  orchestrate: jest.fn().mockResolvedValue({ org: { id: 'org-1' }, subscription: null }),
};

describe('Onboarding Module Integration', () => {
  let idempotencyService: IdempotencyService;
  let metricsService: OnboardingMetricsService;
  let eventBus: LocalEventBus;
  let retryService: ProvisioningRetryService;
  let cleanupService: OnboardingCleanupService;
  let eventBusFactory: EventBusFactory;
  let dispatcherFactory: DispatcherFactory;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        IdempotencyService,
        OnboardingChecklistService,
        OnboardingMetricsService,
        MemoryExporter,
        OnboardingCleanupService,
        LocalEventBus,
        EventBusFactory,
        ImmediateExecutionDispatcher,
        DispatcherFactory,
        ProvisioningRetryService,
        { provide: ProvisioningOrchestratorService, useValue: mockOrchestrator },
        { provide: PROVISION_EVENT_BUS, useExisting: LocalEventBus },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: IndustryTemplateFactory, useValue: mockIndustryFactory },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
    metricsService = module.get<OnboardingMetricsService>(OnboardingMetricsService);
    eventBus = module.get<LocalEventBus>(LocalEventBus);
    retryService = module.get<ProvisioningRetryService>(ProvisioningRetryService);
    cleanupService = module.get<OnboardingCleanupService>(OnboardingCleanupService);
    eventBusFactory = module.get<EventBusFactory>(EventBusFactory);
    dispatcherFactory = module.get<DispatcherFactory>(DispatcherFactory);
  });

  // ─── IdempotencyService ───────────────────────────────────────

  describe('IdempotencyService', () => {
    it('should return null for missing key', async () => {
      mockPrisma.idempotencyRecord.findUnique.mockResolvedValue(null);
      expect(await idempotencyService.findByKey('missing')).toBeNull();
    });

    it('should return cached response for valid key', async () => {
      mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
        key: 'test-key', response: { id: '123' }, expiresAt: new Date(Date.now() + 3600000),
      });
      expect(await idempotencyService.findByKey('test-key')).toEqual({ id: '123' });
    });

    it('should delete expired records and return null', async () => {
      mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
        key: 'expired', response: {}, expiresAt: new Date(Date.now() - 3600000),
      });
      mockPrisma.idempotencyRecord.delete.mockResolvedValue({});
      expect(await idempotencyService.findByKey('expired')).toBeNull();
      expect(mockPrisma.idempotencyRecord.delete).toHaveBeenCalledWith({ where: { key: 'expired' } });
    });

    it('should sanitize sensitive fields before caching', async () => {
      mockPrisma.idempotencyRecord.upsert.mockResolvedValue({});
      await idempotencyService.cacheResponse('key', { password: 'secret', ok: 'data' });
      const call = mockPrisma.idempotencyRecord.upsert.mock.calls[0][0];
      expect(call.create.response.password).toBe('[FILTERED]');
      expect(call.create.response.ok).toBe('data');
    });

    it('should enforce payload size limit', async () => {
      mockPrisma.idempotencyRecord.upsert.mockResolvedValue({});
      const large = { data: 'x'.repeat(20000) };
      await idempotencyService.cacheResponse('large', large);
      const call = mockPrisma.idempotencyRecord.upsert.mock.calls[0][0];
      expect(call.create.response._truncated).toBe(true);
    });

    it('should cleanup expired records', async () => {
      mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 5 });
      expect(await idempotencyService.cleanupExpired()).toBe(5);
    });
  });

  // ─── OnboardingMetricsService ──────────────────────────────────

  describe('OnboardingMetricsService', () => {
    it('should start with zero metrics', () => {
      const m = metricsService.getMetrics();
      expect(m.totalSessions).toBe(0);
      expect(m.completedSessions).toBe(0);
      expect(m.failedSessions).toBe(0);
    });

    it('should track session lifecycle end-to-end', () => {
      metricsService.recordSessionStart('s1');
      expect(metricsService.getMetrics().activeSessions).toBe(1);
      metricsService.recordSessionComplete('s1');
      const m = metricsService.getMetrics();
      expect(m.completedSessions).toBe(1);
      expect(m.activeSessions).toBe(0);
      expect(m.provisioningDurationMs.avg).toBeGreaterThanOrEqual(0);
    });

    it('should track failures', () => {
      metricsService.recordSessionStart('s2');
      metricsService.recordSessionFailed('s2');
      expect(metricsService.getMetrics().failedSessions).toBe(1);
    });

    it('should track retries', () => {
      metricsService.recordRetry('s1');
      metricsService.recordRetry('s1');
      metricsService.recordRetry('s2');
      const m = metricsService.getMetrics();
      expect(m.retryCounts.total).toBe(3);
      expect(m.retryCounts.bySessionId['s1']).toBe(2);
    });

    it('should reset cleanly', () => {
      metricsService.recordSessionStart('s1');
      metricsService.recordSessionComplete('s1');
      metricsService.reset();
      const m = metricsService.getMetrics();
      expect(m.totalSessions).toBe(0);
      expect(m.retryCounts.total).toBe(0);
    });
  });

  // ─── LocalEventBus ─────────────────────────────────────────────

  describe('LocalEventBus', () => {
    it('should publish and subscribe', (done) => {
      const event = {
        sessionId: 's1', type: 'progress' as const,
        data: { progress: 50, currentTask: 'T', completedTasks: [] },
      };
      eventBus.subscribe('s1', (e) => { expect(e).toEqual(event); done(); });
      eventBus.publish(event);
    });

    it('should filter by sessionId', () => {
      const cb = jest.fn();
      const unsub = eventBus.subscribe('s1', cb);
      eventBus.publish({
        sessionId: 's2', type: 'progress',
        data: { progress: 50, currentTask: 'T', completedTasks: [] },
      });
      expect(cb).not.toHaveBeenCalled();
      unsub();
    });

    it('should unsubscribe', () => {
      const cb = jest.fn();
      eventBus.subscribe('s1', cb)();
      eventBus.publish({
        sessionId: 's1', type: 'completed',
        data: { progress: 100, currentTask: 'Done', completedTasks: [] },
      });
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ─── EventBusFactory ───────────────────────────────────────────

  describe('EventBusFactory', () => {
    it('should return local event bus by default', () => {
      const bus = eventBusFactory.create({ type: 'local' });
      expect(bus).toBeDefined();
      expect(typeof bus.publish).toBe('function');
    });

    it('should fall back to local for unknown type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bus = eventBusFactory.create({ type: 'redis' as any });
      expect(bus).toBeDefined();
    });

    it('should list available types', () => {
      const types = eventBusFactory.getAvailableTypes();
      expect(types).toContain('local');
    });
  });

  // ─── DispatcherFactory ─────────────────────────────────────────

  describe('DispatcherFactory', () => {
    it('should return immediate dispatcher by default', () => {
      const d = dispatcherFactory.create({ type: 'immediate' });
      expect(d).toBeDefined();
      expect(typeof d.dispatch).toBe('function');
    });

    it('should fall back for unknown type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dispatcherFactory.create({ type: 'queue' as any });
      expect(d).toBeDefined();
    });
  });

  // ─── RetryPolicy ───────────────────────────────────────────────

  describe('RetryPolicy (isTransientError)', () => {
    it('should classify timeout errors as transient', () => {
      expect(isTransientError(new Error('Request timed out'))).toBe(true);
      expect(isTransientError(new Error('deadlock detected'))).toBe(true);
      expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('should classify validation errors as non-transient', () => {
      expect(isTransientError(new Error('not found'))).toBe(false);
      expect(isTransientError(new Error('invalid input'))).toBe(false);
      expect(isTransientError(new Error('unauthorized'))).toBe(false);
      expect(isTransientError(new Error('Unique constraint violation'))).toBe(false);
    });

    it('should default to transient for unknown errors', () => {
      expect(isTransientError(new Error('something unexpected'))).toBe(true);
    });
  });

  // ─── SessionConflictError ──────────────────────────────────────

  describe('SessionConflictError', () => {
    it('should include structured conflict data', () => {
      const err = new SessionConflictError({
        sessionId: 's1', currentVersion: 5, incomingVersion: 3, requestedFields: ['orgName'],
      });
      const body = err.getResponse() as Record<string, unknown>;
      expect(body).toMatchObject({
        message: 'Session was modified by another device',
        conflictVersion: 5,
        incomingVersion: 3,
        changedFields: ['orgName'],
        sessionId: 's1',
      });
      expect(body.timestamp).toBeDefined();
    });
  });

  // ─── ProvisioningRetryService ──────────────────────────────────

  describe('ProvisioningRetryService', () => {
    it('should succeed on first attempt', async () => {
      const { result } = await retryService.execute(
        () => Promise.resolve('ok'),
        { retryCount: 0, lastFailedTask: null },
      );
      expect(result).toBe('ok');
    });

    it('should retry on failure and succeed', async () => {
      let attempts = 0;
      const { result, retryCount } = await retryService.execute(
        () => { attempts++; return attempts > 1 ? Promise.resolve('ok') : Promise.reject(new Error('timeout')); },
        { retryCount: 0, lastFailedTask: null, sessionId: 's1' },
        { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 },
      );
      expect(result).toBe('ok');
      expect(retryCount).toBe(1);
    });

    it('should not retry non-transient errors', async () => {
      await expect(
        retryService.execute(
          () => Promise.reject(new Error('not found')),
          { retryCount: 0, lastFailedTask: null },
          { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 },
        ),
      ).rejects.toThrow('not found');
    });
  });

  // ─── OnboardingCleanupService ──────────────────────────────────

  describe('OnboardingCleanupService', () => {
    it('should abort when distributed lock is not acquired', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lockSpy = jest.spyOn(cleanupService as any, 'acquireLock').mockResolvedValue(false);
      await cleanupService.cleanup();
      expect(mockAuditService.record).not.toHaveBeenCalled();
      lockSpy.mockRestore();
    });

    it('should execute cleanup when lock is acquired', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lockSpy = jest.spyOn(cleanupService as any, 'acquireLock').mockResolvedValue(true);
      mockPrisma.onboardingSession.findMany.mockResolvedValue([]);
      await cleanupService.cleanup();
      expect(mockAuditService.record).toHaveBeenCalled();
      lockSpy.mockRestore();
    });
  });
});
