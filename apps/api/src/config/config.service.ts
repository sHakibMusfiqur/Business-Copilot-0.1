import { Injectable } from '@nestjs/common';

export type NodeEnv = 'development' | 'production' | 'test';

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

const JWT_SECRET_KEYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

/** Known placeholder shapes that must never be used as a production JWT secret. */
const INSECURE_SECRET_PATTERN = /change[-_ ]?me|changeme|placeholder|your[-_ ]?(secret|jwt)|^your-/i;

/** The only NODE_ENV values the application understands. Anything else is rejected. */
const VALID_NODE_ENV_VALUES: NodeEnv[] = ['development', 'production', 'test'];

/** http(s) URL shapes accepted for API_URL / WEB_URL / CORS_ORIGINS. */
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

/** Accepted network ports (1-65535). */
const PORT_MIN = 1;
const PORT_MAX = 65535;

/**
 * JWT `expiresIn` values allowed to be passed straight to jsonwebtoken. Expiry
 * is a positive integer optionally followed by a supported ms unit. This mirrors
 * the `ms`-style strings the existing JwtModule already accepts.
 */
const JWT_EXPIRY_PATTERN = /^\d+(\.\d+)?(ms|s|m|h|d|w|y)?$/i;

/** Redis connection string must use redis:// or rediss://. */
const REDIS_URL_PATTERN = /^rediss?:\/\/.+$/i;

/** Development/test localhost origins (never applied in production). */
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

  /**
   * Node environment. Unknown/invalid NODE_ENV values fall back to
   * 'development' for runtime safety, but {@link validate} rejects them so a
   * typo like `NODE_ENV=stg` can never silently change behavior.
   */
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

  /**
   * CORS origins allowed by the API.
   *
   * - Development/test: configured WEB_URL plus safe localhost defaults, so local
   *   tooling keeps working out of the box.
   * - Production: only explicitly configured origins. These are WEB_URL plus an
   *   optional CORS_ORIGINS list (comma-separated). Localhost defaults are NEVER
   *   applied in production, so a prod CORS allow-list can never accidentally
   *   become allow-all or trust local origins.
   */
  get corsOrigins(): string[] {
    const webUrl = this.webUrl;
    const explicitOrigins = this.getCorsOriginList();

    const configured = [...(webUrl ? [webUrl] : []), ...explicitOrigins];

    if (this.isProduction) {
      return [...new Set(configured)];
    }
    return [...new Set([...configured, ...DEFAULT_WEB_ORIGINS])];
  }

  get stripeSecretKey(): string {
    return this.getOptionalEnv('STRIPE_SECRET_KEY');
  }

  get stripeWebhookSecret(): string {
    return this.getOptionalEnv('STRIPE_WEBHOOK_SECRET');
  }

 
  get smtpHost(): string {
    return this.getOptionalEnv('SMTP_HOST');
  }

  get smtpPort(): number {
    return this.getInt('SMTP_PORT', 587);
  }

  get smtpUser(): string {
    return this.getOptionalEnv('SMTP_USER');
  }

  get smtpPass(): string {
    return this.getOptionalEnv('SMTP_PASS');
  }

  get smtpFromEmail(): string {
    return this.getOptionalEnv('SMTP_FROM_EMAIL');
  }

  get smtpFromName(): string {
    return this.getOptionalEnv('SMTP_FROM_NAME') || 'Business Copilot';
  }

  get smtpSecure(): boolean {
    return this.getOptionalEnv('SMTP_SECURE') === 'true';
  }

  /** True when a host and sender are configured so a real message can be sent. */
  get hasSmtpConfig(): boolean {
    return Boolean(this.smtpHost) && Boolean(this.smtpFromEmail);
  }

 
  private getCorsOriginList(): string[] {
    const raw = this.getOptionalEnv('CORS_ORIGINS');
    if (!raw) return [];
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  
  get hasStripeCredentials(): boolean {
    return Boolean(this.stripeSecretKey) && Boolean(this.stripeWebhookSecret);
  }

  
  validate(): void {
    const problems: string[] = [];

    for (const key of REQUIRED_ENV_VARS) {
      if (!this.getOptionalEnv(key)) {
        problems.push(`${key} is required.`);
      }
    }


    const nodeEnvRaw = this.getOptionalEnv('NODE_ENV');
    if (nodeEnvRaw && !VALID_NODE_ENV_VALUES.includes(nodeEnvRaw as NodeEnv)) {
      problems.push(
        `NODE_ENV must be one of: ${VALID_NODE_ENV_VALUES.join(', ')}. Received an unsupported value.`,
      );
    }

    // PORT must be a valid network port; never silently fall back in production.
    const portRaw = this.getOptionalEnv('PORT');
    if (portRaw) {
      const parsedPort = Number(portRaw);
      if (!/^\d+$/.test(portRaw.trim()) || parsedPort < PORT_MIN || parsedPort > PORT_MAX) {
        problems.push(`PORT must be an integer between ${PORT_MIN} and ${PORT_MAX}.`);
      }
    }

   
    for (const key of ['API_URL', 'WEB_URL'] as const) {
      const value = this.getOptionalEnv(key);
      if (value && !HTTP_URL_PATTERN.test(value.trim())) {
        problems.push(`${key} must be a valid http(s) URL.`);
      }
    }

    // JWT expiration values feed directly into jsonwebtoken; reject anything
    // that jose/jsonwebtil early.
    for (const key of ['JWT_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN'] as const) {
      const value = this.getOptionalEnv(key);
      if (value && !JWT_EXPIRY_PATTERN.test(value.trim())) {
        problems.push(`${key} must be a positive duration such as "15m", "2h" or "7d".`);
      }
    }

    // Redis is optional. When present it must be a well-formed URL so graceful
    // degradation is never confused with a silently broken connection string.
    const redisUrl = this.redisUrl;
    if (redisUrl && !REDIS_URL_PATTERN.test(redisUrl.trim())) {
      problems.push(`REDIS_URL must start with redis:// or rediss:// when set.`);
    }

    // Stripe is optional, but its two secrets must be configured together. A
    // half-configured gateway (only secret key or only webhook secret) is a
    // misconfiguration, so reject it rather than silently degrade.
    const stripeSecret = this.getOptionalEnv('STRIPE_SECRET_KEY');
    const stripeWebhook = this.getOptionalEnv('STRIPE_WEBHOOK_SECRET');
    const hasSecret = Boolean(stripeSecret);
    const hasWebhook = Boolean(stripeWebhook);
    if (hasSecret !== hasWebhook) {
      problems.push(
        'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must both be set, or both be empty.',
      );
    }

    // SMTP is optional (mail gracefully degrades to a logged "not configured"
    // state). When SMTP_PORT is present it must be a valid network port so a
    // typo cannot silently change the transport to a wrong port.
    const smtpPortRaw = this.getOptionalEnv('SMTP_PORT');
    if (smtpPortRaw) {
      const parsedSmtpPort = Number(smtpPortRaw);
      if (!/^\d+$/.test(smtpPortRaw.trim()) || parsedSmtpPort < PORT_MIN || parsedSmtpPort > PORT_MAX) {
        problems.push(`SMTP_PORT must be an integer between ${PORT_MIN} and ${PORT_MAX}.`);
      }
    }

    // CORS entries (used in production) must be valid HTTP origins.
    for (const origin of this.getCorsOriginList()) {
      if (!HTTP_URL_PATTERN.test(origin)) {
        problems.push(`CORS_ORIGINS contains an invalid http(s) URL entry.`);
        break;
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
