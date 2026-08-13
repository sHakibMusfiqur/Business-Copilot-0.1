import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { WorkspaceAccessService } from './workspace-access.service';

@Module({
  imports: [PrismaModule],
  controllers: [RbacController],
  providers: [RbacService, WorkspaceAccessService],
  exports: [RbacService, WorkspaceAccessService],
})
export class RbacModule {}
