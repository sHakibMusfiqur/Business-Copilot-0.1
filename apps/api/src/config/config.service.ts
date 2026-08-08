import { Injectable } from '@nestjs/common';

export type NodeEnv = 'development' | 'production' | 'test';

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

const JWT_SECRET_KEYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

/** Known placeholder shapes that must never be used as a production JWT secret. */
const INSECURE_SECRET_PATTERN = /change[-_ ]?me|changeme|placeholder|your[-_ ]?(secret|jwt)|^your-/i;

const DEFAULT_WEB_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

@Injectable()
export class ConfigService {
  get redisUrl(): string {
    // Redis is intentionally optional (Phase 0.1 graceful degradation). Callers
    // that require a live client must check RedisService.isEnabled() instead.
    return this.getOptionalEnv('REDIS_URL');
  }

  get jwtSecret(): string {
    return this.getEnv('JWT_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.getEnv('JWT_REFRESH_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.getEnv('JWT_EXPIRES_IN', '15m');
  }

  get jwtRefreshExpiresIn(): string {
    return this.getEnv('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  get apiUrl(): string {
    return this.getEnv('API_URL', 'http://localhost:4000');
  }

  get webUrl(): string {
    return this.getEnv('WEB_URL', 'http://localhost:3000');
  }

  get nodeEnv(): NodeEnv {
    const value = this.getOptionalEnv('NODE_ENV');
    if (value === 'production' || value === 'test') return value;
    return 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.getInt('PORT', 4000);
  }

  get apiPrefix(): string {
    return 'api';
  }

  get appVersion(): string {
    return this.getOptionalEnv('APP_VERSION') || '0.1.0';
  }

  get swaggerEnabled(): boolean {
    return !this.isProduction && this.getOptionalEnv('SWAGGER_ENABLED') === 'true';
  }

  get swaggerTitle(): string {
    return this.getOptionalEnv('SWAGGER_TITLE') || 'Business Copilot API';
  }

  get swaggerDescription(): string {
    return this.getOptionalEnv('SWAGGER_DESCRIPTION') || 'Enterprise ERP + AI Business Copilot API';
  }

  get swaggerVersion(): string {
    return this.getOptionalEnv('SWAGGER_VERSION') || '1.0';
  }

  /** CORS origins allowed by the API, starting with the configured WEB_URL. */
  get corsOrigins(): string[] {
    const webUrl = this.getOptionalEnv('WEB_URL');
    return [...(webUrl ? [webUrl] : []), ...DEFAULT_WEB_ORIGINS];
  }

  get stripeSecretKey(): string {
    return this.getOptionalEnv('STRIPE_SECRET_KEY');
  }

  get stripeWebhookSecret(): string {
    return this.getOptionalEnv('STRIPE_WEBHOOK_SECRET');
  }

  /**
   * True when a full set of Stripe credentials is present. An absent or empty
   * key means Stripe is not configured and payments must gracefully fall back
   * to the free trial instead of failing hard.
   */
  get hasStripeCredentials(): boolean {
    return Boolean(this.stripeSecretKey) && Boolean(this.stripeWebhookSecret);
  }

  /**
   * Validates the environment and throws a clear, secret-free error listing
   * every problem. Required variables fail loudly; optional integrations
   * (Redis, Stripe, AI, Swagger) are not enforced. In production, weak or
   * placeholder JWT secrets are rejected.
   *
   * The error message contains only variable NAMES, never values.
   */
  validate(): void {
    const problems: string[] = [];

    for (const key of REQUIRED_ENV_VARS) {
      if (!this.getOptionalEnv(key)) {
        problems.push(`${key} is required.`);
      }
    }

    if (this.isProduction) {
      for (const key of JWT_SECRET_KEYS) {
        const value = this.getOptionalEnv(key);
        if (!value) continue; // already reported as required above
        if (value.length < 32) {
          problems.push(`${key} must be at least 32 characters in production.`);
        }
        if (INSECURE_SECRET_PATTERN.test(value)) {
          problems.push(`${key} must not use a placeholder or insecure value in production.`);
        }
      }
    }

    if (problems.length > 0) {
      const details = problems.map((p) => `  - ${p}`).join('\n');
      throw new Error(`Environment configuration is invalid:\n${details}`);
    }
  }

  private getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (!value) {
      throw new Error(`Environment variable ${key} is not defined`);
    }
    return value;
  }

  /** Reads an optional env var, returning '' when unset or empty. Never throws. */
  private getOptionalEnv(key: string): string {
    return process.env[key] ?? '';
  }

  private getInt(key: string, defaultValue: number): number {
    const raw = process.env[key];
    if (!raw) return defaultValue;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
}
