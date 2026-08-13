import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacWorkspacePermissions } from '../core/rbac-workspace-permissions';

import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceRuntimeAccessService } from './workspace-runtime-access.service';

@Module({
  imports: [PrismaModule],
  controllers: [RbacController],
  providers: [
    RbacService,
    WorkspaceAccessService,
    RbacWorkspacePermissions,
    WorkspaceRuntimeAccessService,
  ],
  exports: [
    RbacService,
    WorkspaceAccessService,
    RbacWorkspacePermissions,
    WorkspaceRuntimeAccessService,
  ],
})
export class RbacModule {}
