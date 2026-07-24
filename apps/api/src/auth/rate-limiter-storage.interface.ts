export interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

export interface RateLimiterStorage {
  recordAttempt(
    key: string,
    now: number,
    windowMs: number,
    maxAttempts: number,
    blockDurationMs: number,
  ): Promise<RateLimitRecord>;

  clearAttempts(key: string): Promise<void>;

  getRecord(key: string, now: number, windowMs: number): Promise<RateLimitRecord | null>;
}
