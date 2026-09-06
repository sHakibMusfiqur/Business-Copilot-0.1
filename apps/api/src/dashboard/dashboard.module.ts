import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { RedisModule } from '../infrastructure/redis/redis.module';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardConfigService } from './dashboard-config.service';

@Module({
  imports: [PrismaModule, RbacModule, RedisModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardConfigService],
  exports: [DashboardService, DashboardConfigService],
})
export class DashboardModule {}
