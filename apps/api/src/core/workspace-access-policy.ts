import { Injectable } from '@nestjs/common';

import type { CapabilityKey } from '@bc/core';

import type { ResolvedWorkspace } from './workspace-resolver';


@Injectable()
export class WorkspaceAccessPolicy {
  canCapability(workspace: ResolvedWorkspace, capability: CapabilityKey): boolean {
    return workspace.capabilities.can(capability);
  }

  canModule(workspace: ResolvedWorkspace, moduleId: string): boolean {
    return workspace.modules.some((module) => module.id === moduleId);
  }

  hasPermission(workspace: ResolvedWorkspace, permission: string): boolean {
    return workspace.permissions.includes(permission);
  }

  hasFeature(workspace: ResolvedWorkspace, feature: string): boolean {
    return workspace.entitlement.features[feature] === true;
  }

  canUseModule(workspace: ResolvedWorkspace, moduleId: string): boolean {
    const resolved = workspace.modules.some((module) => module.id === moduleId);
    const entitled = workspace.entitlement.modules[moduleId] === true;
    return resolved && entitled;
  }
}