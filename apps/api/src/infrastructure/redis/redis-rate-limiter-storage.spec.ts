import { RedisRateLimiterStorage } from './redis-rate-limiter-storage';

describe('RedisRateLimiterStorage', () => {
  it('uses the shared client via eval() and does not create its own connection', async () => {
    const sharedEval = jest.fn().mockResolvedValue([2, 1000, -1]);
    const sharedClient = { eval: sharedEval } as unknown as import('ioredis').Redis;

    const storage = new RedisRateLimiterStorage(sharedClient);

    const record = await storage.recordAttempt('key', 5000, 60000, 5, 30000);

    expect(sharedEval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'ratelimit:key:attempts',
      'ratelimit:key:blocked',
      '5000',
      '60000',
      '5',
      '30000',
    );
    expect(record).toEqual({ count: 2, firstAttemptAt: 1000, blockedUntil: null });

    // The client passed in is the only connection source; no constructor call happens.
    expect((storage as unknown as { redis: unknown }).redis).toBe(sharedClient);
  });

  it('maps a non-zero blockedUntil to a blocking record', async () => {
    const sharedClient = { eval: jest.fn().mockResolvedValue([5, 1000, 5000]) } as unknown as import('ioredis').Redis;
    const storage = new RedisRateLimiterStorage(sharedClient);

    await expect(storage.recordAttempt('key', 2000, 60000, 5, 30000)).resolves.toEqual({
      count: 5,
      firstAttemptAt: 1000,
      blockedUntil: 5000,
    });
  });

  it('returns null from getRecord for an empty, non-blocked record', async () => {
    const sharedClient = { eval: jest.fn().mockResolvedValue([0, 0, -1]) } as unknown as import('ioredis').Redis;
    const storage = new RedisRateLimiterStorage(sharedClient);

    await expect(storage.getRecord('key', 0, 10000)).resolves.toBeNull();
  });

  it('delegates clearAttempts to the shared client', async () => {
    const sharedEval = jest.fn().mockResolvedValue(1);
    const sharedClient = { eval: sharedEval } as unknown as import('ioredis').Redis;
    const storage = new RedisRateLimiterStorage(sharedClient);

    await storage.clearAttempts('key');

    expect(sharedEval).toHaveBeenCalledWith(
      expect.stringContaining('DEL'),
      2,
      'ratelimit:key:attempts',
      'ratelimit:key:blocked',
    );
  });
});