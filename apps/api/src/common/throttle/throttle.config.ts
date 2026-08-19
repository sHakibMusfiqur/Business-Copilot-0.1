

interface ThrottleLimit {
  readonly limit: number;
  readonly ttl: number;
}

interface ThrottleBucket {
  readonly name: string;
  readonly ttl: number;
  readonly limit: number;
}

/** Parse a non-negative integer from an optional env var, falling back safely. */
function intFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Parse a comma-separated list of non-negative delay (ms) integers. */
function delaysFromEnv(raw: string | undefined): readonly number[] {
  if (!raw || raw.trim() === '') return [0, 2000, 5000, 10000];
  return raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .map((n) => (Number.isFinite(n) && n >= 0 ? n : 0));
}


export const THROTTLE_BUCKETS: ThrottleBucket[] = [
  {
    name: 'short',
    ttl: intFromEnv('THROTTLE_SHORT_TTL_MS', 1000),
    limit: intFromEnv('THROTTLE_SHORT_LIMIT', 10),
  },
  {
    name: 'medium',
    ttl: intFromEnv('THROTTLE_MEDIUM_TTL_MS', 10000),
    limit: intFromEnv('THROTTLE_MEDIUM_LIMIT', 50),
  },
  {
    name: 'long',
    ttl: intFromEnv('THROTTLE_LONG_TTL_MS', 60000),
    limit: intFromEnv('THROTTLE_LONG_LIMIT', 200),
  },
];


export const THROTTLE = {
  veryStrict: {
    limit: intFromEnv('THROTTLE_VERY_STRICT_LIMIT', 5),
    ttl: intFromEnv('THROTTLE_VERY_STRICT_TTL_MS', 60000),
  },
  strict: {
    limit: intFromEnv('THROTTLE_STRICT_LIMIT', 10),
    ttl: intFromEnv('THROTTLE_STRICT_TTL_MS', 60000),
  },
  moderate: {
    limit: intFromEnv('THROTTLE_MODERATE_LIMIT', 20),
    ttl: intFromEnv('THROTTLE_MODERATE_TTL_MS', 60000),
  },
  standard: {
    limit: intFromEnv('THROTTLE_STANDARD_LIMIT', 30),
    ttl: intFromEnv('THROTTLE_STANDARD_TTL_MS', 60000),
  },
  public: {
    limit: intFromEnv('THROTTLE_PUBLIC_LIMIT', 60),
    ttl: intFromEnv('THROTTLE_PUBLIC_TTL_MS', 60000),
  },
  loose: {
    limit: intFromEnv('THROTTLE_LOOSE_LIMIT', 120),
    ttl: intFromEnv('THROTTLE_LOOSE_TTL_MS', 60000),
  },
} satisfies Record<string, ThrottleLimit>;


export const AUTH_THROTTLE = {
  windowMs: intFromEnv('AUTH_THROTTLE_WINDOW_MS', 15 * 60 * 1000),
  maxAttempts: intFromEnv('AUTH_THROTTLE_MAX_ATTEMPTS', 5),
  blockMs: intFromEnv('AUTH_THROTTLE_BLOCK_MS', 15 * 60 * 1000),
  delaysMs: delaysFromEnv(process.env.AUTH_THROTTLE_DELAYS_MS),
} as const;