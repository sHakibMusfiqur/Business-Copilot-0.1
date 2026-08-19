import type { AUTH_THROTTLE, THROTTLE, THROTTLE_BUCKETS } from './throttle.config';

type ThrottleConfigModule = {
  AUTH_THROTTLE: typeof AUTH_THROTTLE;
  THROTTLE: typeof THROTTLE;
  THROTTLE_BUCKETS: typeof THROTTLE_BUCKETS;
};

async function load(): Promise<ThrottleConfigModule> {
  jest.resetModules();
  return import('./throttle.config') as Promise<ThrottleConfigModule>;
}

describe('throttle.config', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses safe defaults matching prior behavior', async () => {
    const { THROTTLE, THROTTLE_BUCKETS, AUTH_THROTTLE } = await load();
    expect(THROTTLE_BUCKETS).toEqual([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]);
    expect(THROTTLE.veryStrict).toEqual({ limit: 5, ttl: 60000 });
    expect(THROTTLE.strict).toEqual({ limit: 10, ttl: 60000 });
    expect(THROTTLE.moderate).toEqual({ limit: 20, ttl: 60000 });
    expect(THROTTLE.standard).toEqual({ limit: 30, ttl: 60000 });
    expect(THROTTLE.public).toEqual({ limit: 60, ttl: 60000 });
    expect(THROTTLE.loose).toEqual({ limit: 120, ttl: 60000 });
    expect(AUTH_THROTTLE).toEqual({
      windowMs: 900000,
      maxAttempts: 5,
      blockMs: 900000,
      delaysMs: [0, 2000, 5000, 10000],
    });
  });

  it('applies env overrides', async () => {
    process.env.THROTTLE_VERY_STRICT_LIMIT = '2';
    process.env.THROTTLE_LOOSE_LIMIT = '500';
    process.env.THROTTLE_SHORT_TTL_MS = '2000';
    process.env.AUTH_THROTTLE_MAX_ATTEMPTS = '3';
    process.env.AUTH_THROTTLE_DELAYS_MS = '100,200';
    const { THROTTLE, THROTTLE_BUCKETS, AUTH_THROTTLE } = await load();
    expect(THROTTLE.veryStrict.limit).toBe(2);
    expect(THROTTLE.loose.limit).toBe(500);
    expect(THROTTLE_BUCKETS[0]).toEqual({ name: 'short', ttl: 2000, limit: 10 });
    expect(AUTH_THROTTLE.maxAttempts).toBe(3);
    expect(AUTH_THROTTLE.delaysMs).toEqual([100, 200]);
  });

  it('falls back to defaults on invalid or negative values', async () => {
    process.env.THROTTLE_PUBLIC_LIMIT = 'not-a-number';
    process.env.THROTTLE_STANDARD_TTL_MS = '-5';
    process.env.AUTH_THROTTLE_BLOCK_MS = 'abc';
    const { THROTTLE, AUTH_THROTTLE } = await load();
    expect(THROTTLE.public.limit).toBe(60);
    expect(THROTTLE.standard.ttl).toBe(60000);
    expect(AUTH_THROTTLE.blockMs).toBe(900000);
  });
});