import { Injectable } from '@nestjs/common';

import type { RateLimitRecord, RateLimiterStorage } from './rate-limiter-storage.interface';

@Injectable()
export class MemoryRateLimiterStorage implements RateLimiterStorage {
  private readonly store = new Map<string, RateLimitRecord>();

  constructor() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  async recordAttempt(
    key: string,
    now: number,
    windowMs: number,
    maxAttempts: number,
    blockDurationMs: number,
  ): Promise<RateLimitRecord> {
    const record = this.store.get(key);

    if (record) {
      if (now - record.firstAttemptAt > windowMs) {
        const fresh: RateLimitRecord = { count: 1, firstAttemptAt: now, blockedUntil: null };
        this.store.set(key, fresh);
        return fresh;
      }

      record.count++;

      if (record.count >= maxAttempts) {
        record.blockedUntil = now + blockDurationMs;
      }

      this.store.set(key, record);
      return { ...record };
    }

    const fresh: RateLimitRecord = { count: 1, firstAttemptAt: now, blockedUntil: null };
    this.store.set(key, fresh);
    return fresh;
  }

  async clearAttempts(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getRecord(key: string, now: number, windowMs: number): Promise<RateLimitRecord | null> {
    const record = this.store.get(key);
    if (!record) return null;

    if (now - record.firstAttemptAt > windowMs) {
      this.store.delete(key);
      return null;
    }

    if (record.blockedUntil && now >= record.blockedUntil) {
      this.store.delete(key);
      return null;
    }

    return { ...record };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now - record.firstAttemptAt > 15 * 60 * 1000) {
        this.store.delete(key);
      } else if (record.blockedUntil && now >= record.blockedUntil) {
        this.store.delete(key);
      }
    }
  }
}
