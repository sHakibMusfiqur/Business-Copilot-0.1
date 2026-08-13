import { ForbiddenException, Injectable } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ModuleRegistry } from '../core/module-registry';
import { WorkspacePermissionMapper } from '../core/workspace-permission.mapper';
import type { ResolvedWorkspace } from '../core/workspace-resolver';
import { WorkspaceRuntimeService } from '../core/workspace-runtime.service';

import { RbacService } from './rbac.service';



@Injectable()
export class WorkspaceAccessService {
  constructor(
    private readonly rbac: RbacService,
    private readonly mapper: WorkspacePermissionMapper,
    private readonly runtime: WorkspaceRuntimeService,
    private readonly registry: ModuleRegistry,
  ) {}

  async resolveForUser(user: CurrentUserPayload): Promise<ResolvedWorkspace> {
    const orgId = this.requireOrganizationId(user);
    const effectivePermissions = await this.rbac.getUserPermissions(
      user.id,
      orgId,
    );
    const access = this.mapper.map(effectivePermissions, this.registry.list());
    return this.runtime.resolve(user, {
      permissions: access.permissions,
      modules: access.moduleIds,
    });
  }

  /** Mirrors the tenant-context guard style used across the API controllers. */
  private requireOrganizationId(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }
}
