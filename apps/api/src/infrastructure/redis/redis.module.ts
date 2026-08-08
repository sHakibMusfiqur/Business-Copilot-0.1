import { Global, Module } from '@nestjs/common';

import { RedisHealthService } from './redis-health.service';
import { RedisService } from './redis.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_HEALTH = 'REDIS_HEALTH';


@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: REDIS_CLIENT,
      inject: [RedisService],
      useFactory: (service: RedisService) => service.getClient(),
    },
    {
      provide: REDIS_HEALTH,
      inject: [RedisService],
      useFactory: (service: RedisService): RedisHealthService | null => {
        const client = service.getClient();
        return client ? new RedisHealthService(client) : null;
      },
    },
  ],
  exports: [RedisService, REDIS_CLIENT, REDIS_HEALTH],
})
export class RedisModule {}