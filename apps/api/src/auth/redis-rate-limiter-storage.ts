import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import type { RateLimitRecord, RateLimiterStorage } from './rate-limiter-storage.interface';

const RECORD_ATTEMPT_SCRIPT = `
  local attempts_key = KEYS[1]
  local block_key = KEYS[2]
  local now = tonumber(ARGV[1])
  local window_ms = tonumber(ARGV[2])
  local max_attempts = tonumber(ARGV[3])
  local block_ms = tonumber(ARGV[4])

  local blocked = redis.call('GET', block_key)
  if blocked then
    local ttl = redis.call('PTTL', block_key)
    local count = redis.call('ZCARD', attempts_key)
    return {count, 0, now + ttl}
  end

  redis.call('ZREMRANGEBYSCORE', attempts_key, '-inf', now - window_ms)
  redis.call('ZADD', attempts_key, now, now)
  local count = redis.call('ZCARD', attempts_key)
  redis.call('PEXPIRE', attempts_key, window_ms)

  local first = redis.call('ZRANGE', attempts_key, 0, 0, 'WITHSCORES')
  local first_ts = 0
  if #first > 0 then first_ts = tonumber(first[2]) end

  if count >= max_attempts then
    redis.call('SET', block_key, '1', 'PX', block_ms)
    return {count, first_ts, now + block_ms}
  end

  return {count, first_ts, -1}
`;

const GET_RECORD_SCRIPT = `
  local attempts_key = KEYS[1]
  local block_key = KEYS[2]
  local now = tonumber(ARGV[1])
  local window_ms = tonumber(ARGV[2])

  local count = redis.call('ZCARD', attempts_key)

  local first = redis.call('ZRANGE', attempts_key, 0, 0, 'WITHSCORES')
  local first_ts = 0
  if #first > 0 then first_ts = tonumber(first[2]) end

  local blocked = redis.call('GET', block_key)
  local blocked_until = -1
  if blocked then
    local ttl = redis.call('PTTL', block_key)
    blocked_until = now + ttl
  end

  return {count, first_ts, blocked_until}
`;

const CLEAR_SCRIPT = `
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
`;

@Injectable()
export class RedisRateLimiterStorage implements RateLimiterStorage {
  private readonly logger = new Logger(RedisRateLimiterStorage.name);
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.redis.connect().catch((err) => {
      this.logger.error(`Failed to connect to Redis: ${err.message}. Rate limiter will fall back.`);
    });
  }

  async recordAttempt(
    key: string,
    now: number,
    windowMs: number,
    maxAttempts: number,
    blockDurationMs: number,
  ): Promise<RateLimitRecord> {
    try {
      const attemptsKey = this.attemptsKey(key);
      const blockKey = this.blockKey(key);

      const result = await this.redis.eval(
        RECORD_ATTEMPT_SCRIPT,
        2,
        attemptsKey,
        blockKey,
        now.toString(),
        windowMs.toString(),
        maxAttempts.toString(),
        blockDurationMs.toString(),
      );

      const [count, firstAttemptAt, blockedUntil] = result as [number, number, number];

      return {
        count,
        firstAttemptAt,
        blockedUntil: blockedUntil > 0 ? blockedUntil : null,
      };
    } catch (error) {
      this.logger.error(`Redis recordAttempt failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async clearAttempts(key: string): Promise<void> {
    try {
      const attemptsKey = this.attemptsKey(key);
      const blockKey = this.blockKey(key);
      await this.redis.eval(CLEAR_SCRIPT, 2, attemptsKey, blockKey);
    } catch (error) {
      this.logger.error(`Redis clearAttempts failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async getRecord(key: string, now: number, windowMs: number): Promise<RateLimitRecord | null> {
    try {
      const attemptsKey = this.attemptsKey(key);
      const blockKey = this.blockKey(key);

      const result = await this.redis.eval(
        GET_RECORD_SCRIPT,
        2,
        attemptsKey,
        blockKey,
        now.toString(),
        windowMs.toString(),
      );

      const [count, firstAttemptAt, blockedUntil] = result as [number, number, number];

      if (count === 0 && blockedUntil <= 0) return null;

      return {
        count,
        firstAttemptAt,
        blockedUntil: blockedUntil > 0 ? blockedUntil : null,
      };
    } catch (error) {
      this.logger.error(`Redis getRecord failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private attemptsKey(key: string): string {
    return `ratelimit:${key}:attempts`;
  }

  private blockKey(key: string): string {
    return `ratelimit:${key}:blocked`;
  }
}
