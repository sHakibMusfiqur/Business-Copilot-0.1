import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { DashboardCacheService } from './dashboard-cache.service';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService, DashboardCacheService],
  exports: [PlatformAdminService, DashboardCacheService],
})
export class PlatformAdminModule {}
