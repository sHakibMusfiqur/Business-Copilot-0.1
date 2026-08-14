import { ForbiddenException, Injectable, Optional } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ModuleRegistry } from '../core/module-registry';
import { RbacWorkspacePermissions } from '../core/rbac-workspace-permissions';
import type { WorkspaceRuntimeOptions } from '../core/workspace-context.adapter';
import { WorkspacePermissionMapper } from '../core/workspace-permission.mapper';
import type { ResolvedWorkspace } from '../core/workspace-resolver';
import { WorkspaceRuntimeService } from '../core/workspace-runtime.service';

import { WorkspacePlanEntitlements } from './workspace-plan-entitlements';


@Injectable()
export class WorkspaceRuntimeAccessService {
  constructor(
    private readonly rbacPermissions: RbacWorkspacePermissions,
    private readonly runtime: WorkspaceRuntimeService,
    private readonly mapper: WorkspacePermissionMapper,
    private readonly registry: ModuleRegistry,
    @Optional() private readonly planEntitlements?: WorkspacePlanEntitlements,
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

    const access = this.mapper.map(effectivePermissions, this.registry.list());

    const callerModules = options.modules;
    const modules =
      callerModules === undefined
        ? access.moduleIds
        : access.moduleIds.filter((id) => callerModules.includes(id));

    // Plan entitlement is resolved at the async DB boundary and is authoritative.
    // When a plan provider is wired, the caller's plan/entitlement are discarded
    // so a caller can never override the organization's plan.
    const planEntitlement = this.planEntitlements
      ? await this.planEntitlements.resolveForOrganization(orgId)
      : undefined;

    const mergedOptions: WorkspaceRuntimeOptions = this.planEntitlements
      ? {
          ...this.withoutCallerEntitlement(options),
          permissions: effectivePermissions,
          modules,
          ...(planEntitlement
            ? { plan: planEntitlement.plan, entitlement: planEntitlement }
            : {}),
        }
      : {
          ...options,
          permissions: effectivePermissions,
          modules,
        };

    return this.runtime.resolve(user, mergedOptions);
  }

  /** Drops any caller-supplied plan/entitlement so only the DB plan applies. */
  private withoutCallerEntitlement(
    options: WorkspaceRuntimeOptions,
  ): WorkspaceRuntimeOptions {
    const { plan: _plan, entitlement: _entitlement, ...rest } = options;
    return rest;
  }

  private requireOrganizationId(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }
}