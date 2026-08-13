import { ForbiddenException, Injectable } from '@nestjs/common';

import type { CapabilityKey } from '@bc/core';

import { WorkspaceAccessPolicy } from './workspace-access-policy';
import type { ResolvedWorkspace } from './workspace-resolver';



@Injectable()
export class WorkspaceAccessEnforcer {
  constructor(private readonly policy: WorkspaceAccessPolicy) {}

  requireCapability(
    workspace: ResolvedWorkspace,
    capability: CapabilityKey,
  ): void {
    if (!this.policy.canCapability(workspace, capability)) {
      throw new ForbiddenException(`Missing required capability: ${capability}`);
    }
  }

  requireModule(workspace: ResolvedWorkspace, moduleId: string): void {
    if (!this.policy.canModule(workspace, moduleId)) {
      throw new ForbiddenException(`Access to module "${moduleId}" is not allowed`);
    }
  }

  requirePermission(workspace: ResolvedWorkspace, permission: string): void {
    if (!this.policy.hasPermission(workspace, permission)) {
      throw new ForbiddenException(`Missing required permission: ${permission}`);
    }
  }

  requireFeature(workspace: ResolvedWorkspace, feature: string): void {
    if (!this.policy.hasFeature(workspace, feature)) {
      throw new ForbiddenException(`Feature "${feature}" is not enabled`);
    }
  }

  requireUsableModule(workspace: ResolvedWorkspace, moduleId: string): void {
    if (!this.policy.canUseModule(workspace, moduleId)) {
      throw new ForbiddenException(`Module "${moduleId}" is not usable`);
    }
  }
}