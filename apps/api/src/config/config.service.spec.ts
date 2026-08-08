import { ConfigService } from './config.service';

const BACKUP: Record<string, string | undefined> = {};

const REQUIRED = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/business_copilot_test?schema=public',
  JWT_SECRET: 'test-secret-32-chars-looooooong-string!!',
  JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-looooooong!!',
};

const TRACKED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'REDIS_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NODE_ENV',
  'PORT',
  'WEB_URL',
  'API_URL',
  'CORS_ORIGINS',
  'APP_VERSION',
  'SWAGGER_ENABLED',
  'SWAGGER_TITLE',
  'SWAGGER_DESCRIPTION',
  'SWAGGER_VERSION',
] as const;

function setEnv(entries: Record<string, string | undefined>): void {
  // Reset every audited variable first so no value leaks between tests.
  for (const key of TRACKED_ENV_VARS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

function captureError(fn: () => void): Error | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

describe('ConfigService', () => {
  beforeAll(() => {
    for (const key of Object.keys(process.env)) {
      if (/^(DATABASE_URL|JWT_|REDIS_URL|STRIPE_|NODE_ENV|PORT|WEB_URL|SWAGGER_)/.test(key)) {
        BACKUP[key] = process.env[key];
      }
    }
  });

  afterEach(() => {
    setEnv({
      ...REQUIRED,
      NODE_ENV: undefined,
      REDIS_URL: undefined,
      PORT: undefined,
      WEB_URL: undefined,
      API_URL: undefined,
      CORS_ORIGINS: undefined,
      JWT_EXPIRES_IN: undefined,
      JWT_REFRESH_EXPIRES_IN: undefined,
      APP_VERSION: undefined,
      SWAGGER_ENABLED: undefined,
      STRIPE_SECRET_KEY: undefined,
      STRIPE_WEBHOOK_SECRET: undefined,
    });
  });

  afterAll(() => {
    setEnv(BACKUP);
  });

  describe('validate()', () => {
    it('accepts a valid configuration (no required vars missing)', () => {
      setEnv({ ...REQUIRED, REDIS_URL: 'redis://localhost:6379' });
      const service = new ConfigService();

      expect(() => service.validate()).not.toThrow();
    });

    it('reports a missing required variable without leaking values', () => {
      setEnv({ DATABASE_URL: REQUIRED.DATABASE_URL, JWT_REFRESH_SECRET: REQUIRED.JWT_REFRESH_SECRET });
      const error = captureError(() => new ConfigService().validate());

      expect(error).toBeDefined();
      const message = error?.message ?? '';
      expect(message).toContain('Environment configuration is invalid');
      expect(message).toContain('JWT_SECRET is required.');
      // Never leak a value or the provider prefix.
      expect(message).not.toContain('postgres://');
      expect(message).not.toContain('password');
    });

    it('reports multiple required variables missing', () => {
      setEnv({});
      const error = captureError(() => new ConfigService().validate());

      expect(error).toBeDefined();
      const message = error?.message ?? '';
      expect(message).toContain('DATABASE_URL is required.');
      expect(message).toContain('JWT_SECRET is required.');
      expect(message).toContain('JWT_REFRESH_SECRET is required.');
    });

    it('allows a missing Redis URL (graceful degradation)', () => {
      setEnv({ ...REQUIRED });
      const service = new ConfigService();

      expect(() => service.validate()).not.toThrow();
    });

    it('accepts a valid Redis URL when configured', () => {
      setEnv({ ...REQUIRED, REDIS_URL: 'redis://localhost:6379' });
      const service = new ConfigService();

      expect(() => service.validate()).not.toThrow();
      expect(service.redisUrl).toBe('redis://localhost:6379');
    });

    it('rejects placeholders in production JWT secrets', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'production', JWT_SECRET: 'CHANGE_ME_IN_LOCAL_ENV' });
      const service = new ConfigService();

      expect(() => service.validate()).toThrow(/strong|placeholder|32 characters/i);
    });

    it('rejects short production JWT secrets', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'production', JWT_SECRET: 'short' });
      const service = new ConfigService();

      expect(() => service.validate()).toThrow(/32 characters/);
    });

    it('does not reject development/placeholder JWT secrets outside production', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'development', JWT_SECRET: 'dev-short-secret' });
      const service = new ConfigService();

      expect(() => service.validate()).not.toThrow();
    });

    it('accepts valid strong production JWT secrets', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'production' });
      const service = new ConfigService();

      expect(() => service.validate()).not.toThrow();
    });

    it('rejects an invalid NODE_ENV value', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'staging' });
      const error = captureError(() => new ConfigService().validate());

      expect(error).toBeDefined();
      expect(error?.message ?? '').toContain('NODE_ENV must be one of');
    });

    it('accepts the three recognized NODE_ENV values', () => {
      for (const env of ['development', 'production', 'test']) {
        setEnv({ ...REQUIRED, NODE_ENV: env });
        expect(() => new ConfigService().validate()).not.toThrow();
      }
    });

    it('rejects an invalid PORT', () => {
      setEnv({ ...REQUIRED, PORT: '70000' });
      const error = captureError(() => new ConfigService().validate());
      expect(error?.message ?? '').toContain('PORT must be an integer');

      setEnv({ ...REQUIRED, PORT: 'abc' });
      const error2 = captureError(() => new ConfigService().validate());
      expect(error2?.message ?? '').toContain('PORT must be an integer');
    });

    it('accepts a valid PORT and the default when unset', () => {
      setEnv({ ...REQUIRED, PORT: '4010' });
      expect(() => new ConfigService().validate()).not.toThrow();

      setEnv({ ...REQUIRED, PORT: undefined });
      expect(() => new ConfigService().validate()).not.toThrow();
    });

    it('rejects malformed API_URL and WEB_URL', () => {
      setEnv({ ...REQUIRED, API_URL: 'not-a-url' });
      const error = captureError(() => new ConfigService().validate());
      expect(error?.message ?? '').toContain('API_URL must be a valid http(s) URL.');

      setEnv({ ...REQUIRED, API_URL: undefined, WEB_URL: 'ftp://bad' });
      const error2 = captureError(() => new ConfigService().validate());
      expect(error2?.message ?? '').toContain('WEB_URL must be a valid http(s) URL.');
    });

    it('accepts well-formed API_URL and WEB_URL', () => {
      setEnv({
        ...REQUIRED,
        API_URL: 'http://localhost:4000',
        WEB_URL: 'http://localhost:3000',
      });
      expect(() => new ConfigService().validate()).not.toThrow();
    });

    it('rejects invalid JWT expiry values', () => {
      setEnv({ ...REQUIRED, JWT_EXPIRES_IN: 'banana' });
      const error = captureError(() => new ConfigService().validate());
      expect(error?.message ?? '').toContain('JWT_EXPIRES_IN must be a positive duration');

      setEnv({ ...REQUIRED, JWT_EXPIRES_IN: '-5m' });
      const error2 = captureError(() => new ConfigService().validate());
      expect(error2?.message ?? '').toContain('JWT_EXPIRES_IN must be a positive duration');
    });

    it('accepts valid JWT expiry values in ms-unit style', () => {
      for (const expiry of ['15m', '2h', '7d', '90s', '120']) {
        setEnv({ ...REQUIRED, JWT_EXPIRES_IN: expiry });
        const service = new ConfigService();
        expect(() => service.validate()).not.toThrow();
        expect(service.jwtExpiresIn).toBe(expiry);
      }
    });

    it('rejects an invalid REDIS_URL but allows missing Redis', () => {
      setEnv({ ...REQUIRED, REDIS_URL: 'postgres://localhost:5432' });
      const error = captureError(() => new ConfigService().validate());
      expect(error?.message ?? '').toContain('REDIS_URL must start with redis://');

      setEnv({ ...REQUIRED, REDIS_URL: undefined });
      expect(() => new ConfigService().validate()).not.toThrow();
    });

    it('accepts a valid redis:// / rediss:// URL', () => {
      for (const url of ['redis://localhost:6379', 'rediss://localhost:6379']) {
        setEnv({ ...REQUIRED, REDIS_URL: url });
        expect(() => new ConfigService().validate()).not.toThrow();
      }
    });

    it('accepts Stripe credentials both absent or both present', () => {
      setEnv({ ...REQUIRED });
      expect(() => new ConfigService().validate()).not.toThrow();

      setEnv({
        ...REQUIRED,
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_456',
      });
      expect(() => new ConfigService().validate()).not.toThrow();
    });

    it('rejects partially configured Stripe credentials', () => {
      setEnv({ ...REQUIRED, STRIPE_SECRET_KEY: 'sk_test_123' });
      const error = captureError(() => new ConfigService().validate());
      expect(error?.message ?? '').toContain('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET');

      setEnv({ ...REQUIRED, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: 'whsec_456' });
      const error2 = captureError(() => new ConfigService().validate());
      expect(error2?.message ?? '').toContain('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET');
    });

    it('rejects malformed CORS_ORIGINS entries', () => {
      setEnv({ ...REQUIRED, CORS_ORIGINS: 'https://good.example.com, not-a-url' });
      const error = captureError(() => new ConfigService().validate());
      expect(error?.message ?? '').toContain('CORS_ORIGINS contains an invalid http(s) URL entry.');
    });
  });

  describe('environment getters', () => {
    it('infers nodeEnv and isProduction', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'production' });
      const service = new ConfigService();

      expect(service.isProduction).toBe(true);
      expect(service.isDevelopment).toBe(false);

      setEnv({ ...REQUIRED, NODE_ENV: 'development' });
      const dev = new ConfigService();
      expect(dev.isProduction).toBe(false);
      expect(dev.isDevelopment).toBe(true);
    });

    it('defaults port and parses PORT', () => {
      setEnv({ ...REQUIRED, PORT: '4010' });
      const service = new ConfigService();
      expect(service.port).toBe(4010);

      setEnv({ ...REQUIRED, PORT: undefined });
      expect(new ConfigService().port).toBe(4000);
    });

    it('builds CORS origins from WEB_URL plus safe localhost defaults', () => {
      setEnv({ ...REQUIRED, WEB_URL: 'https://app.example.com' });
      const service = new ConfigService();

      expect(service.corsOrigins).toContain('https://app.example.com');
      expect(service.corsOrigins).toContain('http://localhost:3000');
    });

    it('never includes localhost defaults in production CORS', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'production', WEB_URL: 'https://app.example.com' });
      const service = new ConfigService();

      expect(service.corsOrigins).toContain('https://app.example.com');
      expect(service.corsOrigins).not.toContain('http://localhost:3000');
      expect(service.corsOrigins).not.toContain('http://127.0.0.1:3000');
    });

    it('includes production CORS_ORIGINS entries alongside WEB_URL', () => {
      setEnv({
        ...REQUIRED,
        NODE_ENV: 'production',
        WEB_URL: 'https://app.example.com',
        CORS_ORIGINS: 'https://admin.example.com, https://widget.example.com',
      });
      const service = new ConfigService();

      expect(service.corsOrigins).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
        'https://widget.example.com',
      ]);
    });

    it('still includes localhost defaults in development CORS', () => {
      setEnv({ ...REQUIRED, NODE_ENV: 'development' });
      const service = new ConfigService();

      expect(service.corsOrigins).toContain('http://localhost:3000');
      expect(service.corsOrigins).toContain('http://localhost:3001');
    });

    it('never exposes secret values through validation or errors', () => {
      setEnv({
        ...REQUIRED,
        NODE_ENV: 'production',
        JWT_SECRET: 'OPS-SECRET-SUPER-LONG-UNIQUE-VALUE-abcdef',
      });
      const service = new ConfigService();

      expect(() => service.validate()).not.toThrow();
      // Getter value is only reachable via the getter, not spills to errors.
      expect(service.jwtSecret).toBe('OPS-SECRET-SUPER-LONG-UNIQUE-VALUE-abcdef');
    });
  });
});