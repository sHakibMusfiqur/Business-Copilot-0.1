import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get databaseUrl(): string {
    return this.getEnv('DATABASE_URL');
  }

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

  get port(): number {
    return Number(this.getEnv('PORT', '4000'));
  }

  get apiUrl(): string {
    return this.getEnv('API_URL', 'http://localhost:4000');
  }

  get webUrl(): string {
    return this.getEnv('WEB_URL', 'http://localhost:3000');
  }

  get nodeEnv(): string {
    return this.getEnv('NODE_ENV', 'development');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  private getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (!value) {
      throw new Error(`Environment variable ${key} is not defined`);
    }
    return value;
  }
}
