import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ConfigService } from '../config/config.service';
import { AuthThrottleGuard } from '../common/guards/auth-throttle.guard';

import { AuditModule } from '../audit/audit.module';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FailsafeRateLimiterStorage } from './failsafe-rate-limiter-storage';
import { MemoryRateLimiterStorage } from './memory-rate-limiter-storage';
import type { RateLimiterStorage } from './rate-limiter-storage.interface';
import { RedisHealthService } from './redis-health.service';
import { RedisRateLimiterStorage } from './redis-rate-limiter-storage';
import { JwtStrategy } from './strategies/jwt.strategy';

let _redisHealth: RedisHealthService | null = null;

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.jwtSecret,
        signOptions: {
          expiresIn: config.jwtExpiresIn as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AuthThrottleGuard,
    AuthRateLimiterService,
    {
      provide: 'REDIS_HEALTH',
      inject: [ConfigService],
      useFactory: (config: ConfigService): RedisHealthService | null => {
        try {
          const redisUrl = config.redisUrl;
          if (redisUrl) {
            _redisHealth = new RedisHealthService(redisUrl);
            return _redisHealth;
          }
        } catch {
          // REDIS_URL not set
        }
        return null;
      },
    },
    {
      provide: 'RATE_LIMITER_STORAGE',
      inject: [ConfigService],
      useFactory: (config: ConfigService): RateLimiterStorage => {
        try {
          const redisUrl = config.redisUrl;
          if (redisUrl && _redisHealth) {
            const redis = new RedisRateLimiterStorage(redisUrl);
            const memory = new MemoryRateLimiterStorage();
            return new FailsafeRateLimiterStorage(redis, memory, _redisHealth);
          }
        } catch {
          // REDIS_URL not set — fall back to in-memory
        }
        return new MemoryRateLimiterStorage();
      },
    },
    MemoryRateLimiterStorage,
  ],
  exports: [AuthService, JwtModule, AuthRateLimiterService, 'REDIS_HEALTH'],
})
export class AuthModule {}
