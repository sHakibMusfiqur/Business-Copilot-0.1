import { Injectable } from '@nestjs/common';

import type {
  CapabilityKey,
  EntitlementContext,
  IndustryKey,
  ModuleManifest,
  ResolvedCapabilities,
  RoleKey,
  WorkspaceContextInput,
} from '@bc/core';

import { CapabilityResolver } from './capability-resolver';
import { EntitlementResolver } from './entitlement-resolver';
import { ModuleResolver } from './module-resolver';


export type WorkspaceResolutionInput = WorkspaceContextInput & {
  capabilities?: CapabilityKey[];
  aiEnabled?: boolean;
};


export interface ResolvedWorkspace {
  tenant: {
    tenantId: string | null;
    organizationName: string | null;
  };
  role: RoleKey | null;
  industry: IndustryKey | null;
  permissions: string[];
  entitlement: EntitlementContext;
  modules: ModuleManifest[];
  enabledModuleIds: string[];
  capabilities: ResolvedCapabilities;
  aiEnabled: boolean;
}


@Injectable()
export class WorkspaceResolver {
  constructor(
    readonly entitlements: EntitlementResolver = new EntitlementResolver(),
    readonly capabilities: CapabilityResolver = new CapabilityResolver(),
  ) {}

  resolve(
    input: WorkspaceContextInput,
    manifests: readonly ModuleManifest[],
  ): ResolvedWorkspace {
    const ctx = input as WorkspaceResolutionInput;


    const entitlement = this.entitlements.resolve({
      plan: ctx.plan,
      modules: ctx.modules,
    });

    const capabilityPool =
      ctx.capabilities ?? this.allDeclaredCapabilities(manifests);


    const allowedModuleIds = Object.keys(entitlement.modules);
    const moduleResolver = new ModuleResolver(manifests);
    const modules = moduleResolver.resolve({
      role: ctx.role ?? null,
      industry: ctx.industry ?? null,
      permissions: ctx.permissions ?? [],
      capabilities: capabilityPool,
      enabledModules: allowedModuleIds,
    });


    const resolvedCapabilities = this.capabilities.resolve(
      modules,
      ctx.capabilities ?? null,
    );


    const aiEnabled =
      ctx.aiEnabled !== undefined
        ? ctx.aiEnabled
        : resolvedCapabilities.granted.includes('ai');

    return {
      tenant: {
        tenantId: ctx.tenantId ?? null,
        organizationName: ctx.organizationName ?? null,
      },
      role: ctx.role ?? null,
      industry: ctx.industry ?? null,
      permissions: ctx.permissions ?? [],
      entitlement,
      modules,

      enabledModuleIds: modules.map((module) => module.id),
      capabilities: resolvedCapabilities,
      aiEnabled,
    };
  }

  private allDeclaredCapabilities(
    manifests: readonly ModuleManifest[],
  ): CapabilityKey[] {
    const set = new Set<CapabilityKey>();
    for (const manifest of manifests) {
      for (const capability of manifest.capabilities) {
        set.add(capability);
      }
    }
    return Array.from(set);
  }
}
