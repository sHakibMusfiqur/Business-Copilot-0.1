import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacWorkspacePermissions } from '../core/rbac-workspace-permissions';

import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspacePlanEntitlements } from './workspace-plan-entitlements';
import { WorkspaceRuntimeAccessService } from './workspace-runtime-access.service';

@Module({
  imports: [PrismaModule],
  controllers: [RbacController],
  providers: [
    RbacService,
    WorkspaceAccessService,
    RbacWorkspacePermissions,
    WorkspacePlanEntitlements,
    WorkspaceRuntimeAccessService,
  ],
  exports: [
    RbacService,
    WorkspaceAccessService,
    RbacWorkspacePermissions,
    WorkspacePlanEntitlements,
    WorkspaceRuntimeAccessService,
  ],
})
export class RbacModule {}
