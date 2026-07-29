import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { IdempotencyService } from './idempotency.service';
import { OnboardingMetricsService } from './onboarding-metrics.service';

export interface CleanupConfig {
  sessionRetentionDays: number;
  batchSize: number;
  lockKey: string;
  lockTtlMs: number;
  cronExpression: string;
}

const DEFAULT_CONFIG: CleanupConfig = {
  sessionRetentionDays: 30,
  batchSize: 100,
  lockKey: 'onboarding:cleanup:lock',
  lockTtlMs: 300000,
  cronExpression: CronExpression.EVERY_DAY_AT_MIDNIGHT,
};

@Injectable()
export class OnboardingCleanupService {
  private readonly logger = new Logger(OnboardingCleanupService.name);
  private readonly config: CleanupConfig;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
    private readonly metricsService: OnboardingMetricsService,
  ) {
    this.config = DEFAULT_CONFIG;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanup(): Promise<void> {
    if (this.running) {
      this.logger.warn('Cleanup already in progress, skipping overlapping execution');
      return;
    }

    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.warn('Could not acquire distributed lock, another instance may be running cleanup');
      return;
    }

    this.running = true;
    const start = Date.now();
    const stats = { sessionsRemoved: 0, idempotencyRemoved: 0 };

    try {
      stats.sessionsRemoved = await this.cleanupExpiredSessions();
      stats.idempotencyRemoved = await this.idempotencyService.cleanupExpired();

      this.metricsService.getMetrics();

      const duration = Date.now() - start;
      this.logger.log(`Cleanup complete: ${JSON.stringify(stats)} in ${duration}ms`);

      await this.auditService.record({
        action: 'ONBOARDING_CLEANUP',
        status: 'SUCCESS',
        entity: 'OnboardingCleanup',
        entityId: 'scheduled',
        metadata: { ...stats, durationMs: duration, config: this.config },
      });
    } catch (error) {
      this.logger.error(`Cleanup failed: ${(error as Error).message}`);
      await this.auditService.record({
        action: 'ONBOARDING_CLEANUP',
        status: 'FAILURE',
        entity: 'OnboardingCleanup',
        entityId: 'scheduled',
        metadata: { error: (error as Error).message },
      });
    } finally {
      await this.releaseLock();
      this.running = false;
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const result = await this.prisma.$executeRawUnsafe(
        `SELECT pg_try_advisory_lock(hashtext($1)) AS locked`,
        [this.config.lockKey],
      );
      return result === 1;
    } catch {
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `SELECT pg_advisory_unlock(hashtext($1))`,
        [this.config.lockKey],
      );
    } catch {
      // Lock release failures are non-fatal
    }
  }

  private async cleanupExpiredSessions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.sessionRetentionDays);

    let total = 0;
    let hasMore = true;

    while (hasMore) {
      const sessions = await this.prisma.onboardingSession.findMany({
        where: {
          updatedAt: { lte: cutoff },
          provisionStatus: { in: ['COMPLETED', 'FAILED'] },
        },
        take: this.config.batchSize,
        select: { id: true },
      });

      if (sessions.length === 0) {
        hasMore = false;
        break;
      }

      const ids = sessions.map((s) => s.id);
      await this.prisma.onboardingSession.deleteMany({ where: { id: { in: ids } } });
      total += ids.length;

      if (sessions.length < this.config.batchSize) {
        hasMore = false;
      }
    }

    return total;
  }
}
