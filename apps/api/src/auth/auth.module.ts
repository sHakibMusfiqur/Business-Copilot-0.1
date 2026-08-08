import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ConfigService } from '../config/config.service';
import { AuthThrottleGuard } from '../common/guards/auth-throttle.guard';
import { MailModule } from '../mail/mail.module';
import { REDIS_HEALTH, REDIS_CLIENT } from '../infrastructure/redis/redis.module';

import { AuditModule } from '../audit/audit.module';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FailsafeRateLimiterStorage } from './failsafe-rate-limiter-storage';
import { MemoryRateLimiterStorage } from './memory-rate-limiter-storage';
import type { RateLimiterStorage } from './rate-limiter-storage.interface';
import { RedisHealthService } from '../infrastructure/redis/redis-health.service';
import { RedisRateLimiterStorage } from '../infrastructure/redis/redis-rate-limiter-storage';
import { JwtStrategy } from './strategies/jwt.strategy';

import type Redis from 'ioredis';

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
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AuthThrottleGuard,
    AuthRateLimiterService,
    {
      provide: 'RATE_LIMITER_STORAGE',
      inject: [REDIS_CLIENT, REDIS_HEALTH],
      useFactory: (
        client: Redis | null,
        health: RedisHealthService | null,
      ): RateLimiterStorage => {
        const memory = new MemoryRateLimiterStorage();
        if (client && health) {
          const redis = new RedisRateLimiterStorage(client);
          return new FailsafeRateLimiterStorage(redis, memory, health);
        }
        return memory;
      },
    },
    MemoryRateLimiterStorage,
  ],
  exports: [AuthService, JwtModule, AuthRateLimiterService, 'RATE_LIMITER_STORAGE'],
})
export class AuthModule {}
