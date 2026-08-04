import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuthThrottleGuard } from '../common/guards/auth-throttle.guard';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  imports: [AuthModule, AuditModule, PrismaModule],
  controllers: [PlatformAdminController, AdminAuthController],
  providers: [PlatformAdminService, DashboardCacheService, AdminAuthService, AuthThrottleGuard],
  exports: [PlatformAdminService, DashboardCacheService],
})
export class PlatformAdminModule {}
