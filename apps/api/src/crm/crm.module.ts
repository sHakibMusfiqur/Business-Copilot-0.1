import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { ActivityService } from './activity.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [LeadController],
  providers: [LeadService, ActivityService],
  exports: [LeadService, ActivityService],
})
export class CrmModule {}
