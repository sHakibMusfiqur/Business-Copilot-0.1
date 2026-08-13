import { ForbiddenException, Injectable } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacWorkspacePermissions } from '../core/rbac-workspace-permissions';
import type { WorkspaceRuntimeOptions } from '../core/workspace-context.adapter';
import type { ResolvedWorkspace } from '../core/workspace-resolver';
import { WorkspaceRuntimeService } from '../core/workspace-runtime.service';



@Injectable()
export class WorkspaceRuntimeAccessService {
  constructor(
    private readonly rbacPermissions: RbacWorkspacePermissions,
    private readonly runtime: WorkspaceRuntimeService,
  ) {}

  async resolveForUser(
    user: CurrentUserPayload,
    options: WorkspaceRuntimeOptions = {},
  ): Promise<ResolvedWorkspace> {
    const orgId = this.requireOrganizationId(user);
    const effectivePermissions = await this.rbacPermissions.resolveForUser(
      orgId,
      user.id,
    );

    const mergedOptions: WorkspaceRuntimeOptions = {
      ...options,
      permissions: effectivePermissions,
    };

    return this.runtime.resolve(user, mergedOptions);
  }

 
  private requireOrganizationId(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }
}