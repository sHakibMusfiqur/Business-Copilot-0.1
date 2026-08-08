import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PublicHealthController } from './public-health.controller';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, PublicHealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class SystemModule {}
