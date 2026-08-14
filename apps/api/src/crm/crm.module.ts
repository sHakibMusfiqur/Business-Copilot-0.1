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
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineStageController } from './pipeline-stage.controller';
import { PipelineStageService } from './pipeline-stage.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [LeadController, ContactController, DealController, PipelineController, PipelineStageController],
  providers: [LeadService, ActivityService, ContactService, DealService, PipelineService, PipelineStageService],
  exports: [LeadService, ActivityService, ContactService, DealService, PipelineService, PipelineStageService],
})
export class CrmModule {}
