import { Inject, Injectable, Logger } from '@nestjs/common';

import type { RateLimiterStorage } from './rate-limiter-storage.interface';

@Injectable()
export class AuthRateLimiterService {
  private readonly logger = new Logger(AuthRateLimiterService.name);
  private readonly WINDOW_MS = 15 * 60 * 1000;
  private readonly MAX_ATTEMPTS = 5;
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000;
  private readonly DELAYS = [0, 2000, 5000, 10000];

  constructor(@Inject('RATE_LIMITER_STORAGE') private readonly storage: RateLimiterStorage) {}

  async recordAttempt(key: string): Promise<void> {
    const now = Date.now();
    const record = await this.storage.recordAttempt(key, now, this.WINDOW_MS, this.MAX_ATTEMPTS, this.BLOCK_DURATION_MS);

    if (record.blockedUntil) {
      this.logger.warn(`Rate limit BLOCKED key=${key} count=${record.count}`);
    }
  }

  async clearAttempts(key: string): Promise<void> {
    await this.storage.clearAttempts(key);
  }

  async isBlocked(key: string): Promise<boolean> {
    const record = await this.storage.getRecord(key, Date.now(), this.WINDOW_MS);
    if (!record) return false;
    if (record.blockedUntil && Date.now() < record.blockedUntil) {
      return true;
    }
    return false;
  }

  async getDelayMs(key: string): Promise<number> {
    const record = await this.storage.getRecord(key, Date.now(), this.WINDOW_MS);
    if (!record) return 0;
    const index = Math.min(record.count - 1, this.DELAYS.length - 1);
    return this.DELAYS[Math.max(0, index)];
  }

  async getRemainingBlockedMs(key: string): Promise<number> {
    const record = await this.storage.getRecord(key, Date.now(), this.WINDOW_MS);
    if (!record?.blockedUntil) return 0;
    return Math.max(0, record.blockedUntil - Date.now());
  }
}
