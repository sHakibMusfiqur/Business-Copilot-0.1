import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get redisUrl(): string {
    return this.getEnv('REDIS_URL');
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
}
