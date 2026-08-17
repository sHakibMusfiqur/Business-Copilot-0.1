import { CompensationManager } from './compensation-manager';

describe('CompensationManager', () => {
  it('preserves failed provisioning state when rolling back', async () => {
    const mockPrisma = {
      onboardingSession: {
        findUnique: jest.fn().mockResolvedValue({
          provisionData: {
            progress: 40,
            currentTask: 'Configuring departments...',
            failedTask: 'Configuring departments...',
            error: 'boom',
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const manager = new CompensationManager(mockPrisma as never, mockAuditService as never);
    manager.register('cleanup', jest.fn().mockResolvedValue(undefined));

    await manager.rollback('session-1');

    expect(mockPrisma.onboardingSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', provisionStatus: { not: 'COMPLETED' } },
      data: {
        provisionStatus: 'FAILED',
        provisionData: expect.objectContaining({
          progress: 40,
          currentTask: 'Configuring departments...',
          failedTask: 'Configuring departments...',
          error: 'boom',
          rolledBack: true,
          rolledBackAt: expect.any(String),
        }),
      },
    });
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLLBACK_COMPLETED' }),
    );
  });

  it('does NOT execute destructive compensation against an already-COMPLETED session', async () => {
    const mockPrisma = {
      onboardingSession: {
        findUnique: jest.fn().mockResolvedValue({ provisionData: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const manager = new CompensationManager(mockPrisma as never, mockAuditService as never);
    const cleanup = jest.fn().mockResolvedValue(undefined);
    manager.register('cleanup', cleanup);

    await manager.rollback('session-1');

    expect(cleanup).not.toHaveBeenCalled();
    expect(mockPrisma.onboardingSession.update).not.toHaveBeenCalled();
    expect(mockAuditService.record).not.toHaveBeenCalled();
  });

  it('records rollback errors without re-claiming the session', async () => {
    const mockPrisma = {
      onboardingSession: {
        findUnique: jest.fn().mockResolvedValue({
          provisionData: { failedTask: 'Configuring departments...' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const manager = new CompensationManager(mockPrisma as never, mockAuditService as never);
    manager.register('cleanup', jest.fn().mockRejectedValue(new Error('boom')));

    await manager.rollback('session-1');

    expect(mockPrisma.onboardingSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        provisionData: expect.objectContaining({
          rollbackErrors: ['Compensation failed for cleanup: boom'],
          rolledBack: true,
        }),
      },
    });
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLLBACK_FAILED' }),
    );
  });
});