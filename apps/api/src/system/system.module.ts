import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PublicHealthController } from './public-health.controller';

@Module({
  controllers: [HealthController, PublicHealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class SystemModule {}
