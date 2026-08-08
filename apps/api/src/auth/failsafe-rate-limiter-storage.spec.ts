import { FailsafeRateLimiterStorage } from './failsafe-rate-limiter-storage';
import { MemoryRateLimiterStorage } from './memory-rate-limiter-storage';
import type { RedisHealthService } from '../infrastructure/redis/redis-health.service';
import type { RedisRateLimiterStorage } from '../infrastructure/redis/redis-rate-limiter-storage';
import type { RateLimitRecord } from './rate-limiter-storage.interface';

type RedisStorageMock = RedisRateLimiterStorage & {
  recordAttempt: jest.Mock;
  clearAttempts: jest.Mock;
  getRecord: jest.Mock;
};

function createHealthMock() {
  let up: (() => void) | null = null;
  let down: (() => void) | null = null;
  const health = {
    set onRedisUp(cb: (() => void) | null) {
      up = cb;
    },
    set onRedisDown(cb: (() => void) | null) {
      down = cb;
    },
    fireUp: () => up?.(),
    fireDown: () => down?.(),
  } as unknown as RedisHealthService & { fireUp: () => void; fireDown: () => void };
  return health;
}

const KEY = 'k';
const NOW = 1;
const WINDOW = 2;
const MAX = 3;
const BLOCK = 4;
const record: RateLimitRecord = { count: 1, firstAttemptAt: NOW, blockedUntil: null };

function createRedisMock(rejects = false): RedisStorageMock {
  const fn = rejects ? jest.fn().mockRejectedValue(new Error('redis down')) : jest.fn().mockResolvedValue(record);
  return {
    recordAttempt: fn,
    clearAttempts: fn,
    getRecord: fn,
  } as RedisStorageMock;
}

describe('FailsafeRateLimiterStorage', () => {
  it('falls back to memory when Redis fails, then restores Redis on recovery', async () => {
    const redis = createRedisMock(true);
    const memory = new MemoryRateLimiterStorage();
    const health = createHealthMock();

    const failsafe = new FailsafeRateLimiterStorage(redis, memory, health);

    expect(failsafe.active).toBe('redis');

    await failsafe.recordAttempt(KEY, NOW, WINDOW, MAX, BLOCK);
    expect(failsafe.active).toBe('memory');
    expect(failsafe.fallbackCount).toBe(1);

    health.fireUp();
    expect(failsafe.active).toBe('redis');
  });

  it('records to Redis when it is healthy', async () => {
    const redis = createRedisMock(false);
    const memory = new MemoryRateLimiterStorage();
    const health = createHealthMock();

    const failsafe = new FailsafeRateLimiterStorage(redis, memory, health);

    await expect(failsafe.recordAttempt(KEY, NOW, WINDOW, MAX, BLOCK)).resolves.toEqual(record);
    expect(failsafe.active).toBe('redis');
    expect(redis.recordAttempt).toHaveBeenCalledWith(KEY, NOW, WINDOW, MAX, BLOCK);
  });

  it('switches to memory when health reports Redis down', async () => {
    const redis = createRedisMock(false);
    const memory = new MemoryRateLimiterStorage();
    const health = createHealthMock();

    const failsafe = new FailsafeRateLimiterStorage(redis, memory, health);

    health.fireDown();
    expect(failsafe.active).toBe('memory');
    expect(failsafe.fallbackCount).toBe(1);

    await failsafe.recordAttempt(KEY, NOW, WINDOW, MAX, BLOCK);
    expect(redis.recordAttempt).not.toHaveBeenCalled();
  });
});