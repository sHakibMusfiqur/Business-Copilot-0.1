import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnboardingMetricsService } from './onboarding-metrics.service';

export interface AdminHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
}

export interface AdminProvisionSummary {
  total: number;
  pending: number;
  provisioning: number;
  completed: number;
  failed: number;
  expired: number;
}

export interface AdminRetryStats {
  totalRetries: number;
  sessionsWithRetries: number;
  recentRetries: { sessionId: string; count: number }[];
}

export interface AdminRollbackStats {
  totalRollbacks: number;
  recentRollbacks: { sessionId: string; timestamp: string }[];
}

export interface AdminCleanupStats {
  lastRun: string | null;
  totalSessionsRemoved: number;
  totalIdempotencyRemoved: number;
  status: 'SUCCESS' | 'FAILURE' | 'never_run';
}

export interface AdminDashboard {
  health: AdminHealthStatus;
  provision: AdminProvisionSummary;
  metrics: ReturnType<OnboardingMetricsService['getMetrics']>;
  retries: AdminRetryStats;
  cleanup: AdminCleanupStats;
}

@Injectable()
export class OnboardingAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: OnboardingMetricsService,
  ) {}

  async getDashboard(): Promise<AdminDashboard> {
    const [provision, health, cleanup] = await Promise.all([
      this.getProvisionSummary(),
      this.getHealth(),
      this.getCleanupStats(),
    ]);

    const metrics = this.metricsService.getMetrics();

    return {
      health,
      provision,
      metrics,
      retries: {
        totalRetries: metrics.retryCounts.total,
        sessionsWithRetries: Object.keys(metrics.retryCounts.bySessionId).length,
        recentRetries: Object.entries(metrics.retryCounts.bySessionId)
          .map(([sessionId, count]) => ({ sessionId, count }))
          .slice(-20),
      },
      cleanup,
    };
  }

  private async getProvisionSummary(): Promise<AdminProvisionSummary> {
    const [total, pending, provisioning, completed, failed, expired] = await Promise.all([
      this.prisma.onboardingSession.count(),
      this.prisma.onboardingSession.count({ where: { provisionStatus: 'PENDING' } }),
      this.prisma.onboardingSession.count({ where: { provisionStatus: 'PROVISIONING' } }),
      this.prisma.onboardingSession.count({ where: { provisionStatus: 'COMPLETED' } }),
      this.prisma.onboardingSession.count({ where: { provisionStatus: 'FAILED' } }),
      this.prisma.onboardingSession.count({ where: { provisionStatus: 'EXPIRED' } }),
    ]);

    return { total, pending, provisioning, completed, failed, expired };
  }

  private async getHealth(): Promise<AdminHealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  }

  private async getCleanupStats(): Promise<AdminCleanupStats> {
    const lastAudit = await this.prisma.auditLog.findFirst({
      where: { action: 'ONBOARDING_CLEANUP' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true, metadata: true },
    });

    if (!lastAudit) {
      return {
        lastRun: null,
        totalSessionsRemoved: 0,
        totalIdempotencyRemoved: 0,
        status: 'never_run',
      };
    }

    const meta = lastAudit.metadata as Record<string, unknown> | null;
    return {
      lastRun: lastAudit.createdAt.toISOString(),
      totalSessionsRemoved: (meta?.sessionsRemoved as number) ?? 0,
      totalIdempotencyRemoved: (meta?.idempotencyRemoved as number) ?? 0,
      status: lastAudit.status as 'SUCCESS' | 'FAILURE',
    };
  }
}
