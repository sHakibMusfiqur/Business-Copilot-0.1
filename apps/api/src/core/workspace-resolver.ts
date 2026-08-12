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

/** The effective workspace context accepted by the pipeline. */
export type WorkspaceResolutionInput = WorkspaceContextInput & {
  /** Optional explicit capability pool/allow-list supplied by the workspace. */
  capabilities?: CapabilityKey[];
  /** Optional explicit AI override. When absent, AI is derived from capabilities. */
  aiEnabled?: boolean;
};

/**
 * The resolved output of the workspace pipeline. `@bc/core` does not define this
 * exact structure, so it is declared locally.
 */
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

/**
 * Pure, deterministic workspace resolution pipeline. Composes the three existing
 * resolvers (Entitlement, Module, Capability) into a single canonical result.
 *
 * Pipeline order is always:
 *   1. entitlement   -> EntitlementResolver (plan/features/modules/limits/status pass-through)
 *   2. modules       -> ModuleResolver, gated by entitlement modules + permissions + role/industry
 *   3. capabilities  -> CapabilityResolver, derived only from the resolved modules
 *   4. aiEnabled     -> derived from capabilities unless explicitly overridden
 *
 * It never queries a DB, touches Prisma/HTTP/auth, mutates inputs, or holds
 * mutable state between calls.
 */
export class WorkspaceResolver {
  private readonly entitlements = new EntitlementResolver();
  private readonly capabilities = new CapabilityResolver();

  resolve(
    input: WorkspaceContextInput,
    manifests: readonly ModuleManifest[],
  ): ResolvedWorkspace {
    const ctx = input as WorkspaceResolutionInput;

    // 1. Entitlement (pure pass-through; no billing/subscription lookup).
    const entitlement = this.entitlements.resolve({
      plan: ctx.plan,
      modules: ctx.modules,
    });

    // Module gating capability set: explicit workspace capabilities when given,
    // otherwise the union of all supplied module capabilities (so capability
    // gating is a no-op and modules resolve on permissions/entitlement/visibility).
    const capabilityPool =
      ctx.capabilities ?? this.allDeclaredCapabilities(manifests);

    // 2. Module resolution. The entitlement's enabled module set is respected.
    const allowedModuleIds = Object.keys(entitlement.modules);
    const moduleResolver = new ModuleResolver(manifests);
    const modules = moduleResolver.resolve({
      role: ctx.role ?? null,
      industry: ctx.industry ?? null,
      permissions: ctx.permissions ?? [],
      capabilities: capabilityPool,
      enabledModules: allowedModuleIds,
    });

    // 3. Capability resolution, restricted by the explicit allow-list when given.
    const resolvedCapabilities = this.capabilities.resolve(
      modules,
      ctx.capabilities ?? null,
    );

    // 4. AI: explicit override wins; otherwise derived from capabilities.
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
      // Reflect the modules that actually resolved, not the requested allow-list.
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