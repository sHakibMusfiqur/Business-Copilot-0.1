import { Inject, Injectable, Optional } from '@nestjs/common';

import type { ActiveStorage } from '../auth/failsafe-rate-limiter-storage';
import { FailsafeRateLimiterStorage } from '../auth/failsafe-rate-limiter-storage';
import { RedisHealthService } from '../infrastructure/redis/redis-health.service';
import type { RedisHealthMetrics } from '../infrastructure/redis/redis-health.service';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: number;
  database: { status: 'connected' | 'disconnected' };
  redis: RedisHealthMetrics | null;
  rateLimiter: {
    storage: ActiveStorage;
    fallbackCount: number;
  };
}

export interface PublicHealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('REDIS_HEALTH') private readonly redisHealth?: RedisHealthService,
    @Optional() @Inject('RATE_LIMITER_STORAGE')
    private readonly storage?: unknown,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const dbStatus = await this.checkDatabase();
    const redisMetrics = this.redisHealth?.getMetrics() ?? null;
    const now = Date.now();

    const overallStatus =
      dbStatus === 'disconnected' ? 'unhealthy' : 'healthy';

    const rateLimiterInfo = this.getRateLimiterInfo();

    return {
      status: overallStatus,
      uptime: now - this.startTime,
      timestamp: now,
      database: { status: dbStatus },
      redis: redisMetrics,
      rateLimiter: rateLimiterInfo,
    };
  }

  async checkPublic(): Promise<PublicHealthCheckResult> {
    const now = Date.now();
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      overallStatus = 'healthy';
    } catch {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: now,
      uptime: now - this.startTime,
    };
  }

  private async checkDatabase(): Promise<'connected' | 'disconnected'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  private getRateLimiterInfo(): { storage: ActiveStorage; fallbackCount: number } {
    if (this.storage instanceof FailsafeRateLimiterStorage) {
      return {
        storage: this.storage.active,
        fallbackCount: this.storage.fallbackCount,
      };
    }
    return { storage: 'memory', fallbackCount: 0 };
  }
}
