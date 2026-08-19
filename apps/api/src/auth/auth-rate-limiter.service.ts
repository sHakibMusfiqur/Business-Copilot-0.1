import { Inject, Injectable, Logger } from '@nestjs/common';

import type { RateLimiterStorage } from './rate-limiter-storage.interface';
import { AUTH_THROTTLE } from '../common/throttle/throttle.config';

@Injectable()
export class AuthRateLimiterService {
  private readonly logger = new Logger(AuthRateLimiterService.name);

  constructor(@Inject('RATE_LIMITER_STORAGE') private readonly storage: RateLimiterStorage) {}

  async recordAttempt(key: string): Promise<void> {
    const now = Date.now();
    const record = await this.storage.recordAttempt(
      key,
      now,
      AUTH_THROTTLE.windowMs,
      AUTH_THROTTLE.maxAttempts,
      AUTH_THROTTLE.blockMs,
    );

    if (record.blockedUntil) {
      this.logger.warn(`Rate limit BLOCKED key=${key} count=${record.count}`);
    }
  }

  async clearAttempts(key: string): Promise<void> {
    await this.storage.clearAttempts(key);
  }

  async isBlocked(key: string): Promise<boolean> {
    const record = await this.storage.getRecord(key, Date.now(), AUTH_THROTTLE.windowMs);
    if (!record) return false;
    if (record.blockedUntil && Date.now() < record.blockedUntil) {
      return true;
    }
    return false;
  }

  async getDelayMs(key: string): Promise<number> {
    const record = await this.storage.getRecord(key, Date.now(), AUTH_THROTTLE.windowMs);
    if (!record) return 0;
    const index = Math.min(record.count - 1, AUTH_THROTTLE.delaysMs.length - 1);
    return AUTH_THROTTLE.delaysMs[Math.max(0, index)];
  }

  async getRemainingBlockedMs(key: string): Promise<number> {
    const record = await this.storage.getRecord(key, Date.now(), AUTH_THROTTLE.windowMs);
    if (!record?.blockedUntil) return 0;
    return Math.max(0, record.blockedUntil - Date.now());
  }
}
