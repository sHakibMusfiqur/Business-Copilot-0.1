import { Logger } from '@nestjs/common';

import type { RedisHealthService } from '../infrastructure/redis/redis-health.service';
import type { RedisRateLimiterStorage } from '../infrastructure/redis/redis-rate-limiter-storage';
import type { MemoryRateLimiterStorage } from './memory-rate-limiter-storage';
import type { RateLimitRecord, RateLimiterStorage } from './rate-limiter-storage.interface';

export type ActiveStorage = 'redis' | 'memory';

export class FailsafeRateLimiterStorage implements RateLimiterStorage {
  private readonly logger = new Logger(FailsafeRateLimiterStorage.name);
  private _active: ActiveStorage = 'redis';
  private _fallbackCount = 0;

  constructor(
    private readonly redis: RedisRateLimiterStorage,
    private readonly memory: MemoryRateLimiterStorage,
    private readonly health: RedisHealthService,
  ) {
    this.health.onRedisDown = () => {
      if (this._active === 'redis') {
        this._active = 'memory';
        this._fallbackCount++;
        this.logger.warn('Fallback Activated: switched to in-memory rate limiter');
      }
    };

    this.health.onRedisUp = () => {
      if (this._active === 'memory') {
        this._active = 'redis';
        this.logger.log('Fallback Deactivated: restored Redis rate limiter');
      }
    };
  }

  get active(): ActiveStorage {
    return this._active;
  }

  get fallbackCount(): number {
    return this._fallbackCount;
  }

  async recordAttempt(
    key: string,
    now: number,
    windowMs: number,
    maxAttempts: number,
    blockDurationMs: number,
  ): Promise<RateLimitRecord> {
    if (this._active === 'redis') {
      try {
        return await this.redis.recordAttempt(key, now, windowMs, maxAttempts, blockDurationMs);
      } catch {
        this._active = 'memory';
        this._fallbackCount++;
        this.logger.warn('Fallback Activated: Redis recordAttempt failed, using memory');
      }
    }
    return await this.memory.recordAttempt(key, now, windowMs, maxAttempts, blockDurationMs);
  }

  async clearAttempts(key: string): Promise<void> {
    if (this._active === 'redis') {
      try {
        await this.redis.clearAttempts(key);
        return;
      } catch {
        this._active = 'memory';
        this._fallbackCount++;
        this.logger.warn('Fallback Activated: Redis clearAttempts failed, using memory');
      }
    }
    await this.memory.clearAttempts(key);
  }

  async getRecord(key: string, now: number, windowMs: number): Promise<RateLimitRecord | null> {
    if (this._active === 'redis') {
      try {
        return await this.redis.getRecord(key, now, windowMs);
      } catch {
        this._active = 'memory';
        this._fallbackCount++;
        this.logger.warn('Fallback Activated: Redis getRecord failed, using memory');
      }
    }
    return await this.memory.getRecord(key, now, windowMs);
  }
}
