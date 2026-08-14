import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { ActivityService } from './activity.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [LeadController, ContactController, DealController],
  providers: [LeadService, ActivityService, ContactService, DealService],
  exports: [LeadService, ActivityService, ContactService, DealService],
})
export class CrmModule {}
