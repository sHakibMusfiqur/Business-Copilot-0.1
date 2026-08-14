import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { ActivityService } from './activity.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [LeadController, ContactController],
  providers: [LeadService, ActivityService, ContactService],
  exports: [LeadService, ActivityService, ContactService],
})
export class CrmModule {}
