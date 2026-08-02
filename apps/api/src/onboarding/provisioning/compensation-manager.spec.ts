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
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const manager = new CompensationManager(mockPrisma as never, mockAuditService as never);
    manager.register('cleanup', jest.fn().mockResolvedValue(undefined));

    await manager.rollback('session-1');

    expect(mockPrisma.onboardingSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
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
  });
});