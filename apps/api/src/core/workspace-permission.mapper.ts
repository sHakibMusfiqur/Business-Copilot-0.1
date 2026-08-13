import { Injectable } from '@nestjs/common';

import type { CapabilityKey, ModuleManifest } from '@bc/core';


/** The access a permission set unlocks, derived purely from module manifests. */
export interface PermissionAccess {
  /** Normalized, de-duplicated, deterministically ordered effective permissions. */
  permissions: string[];
  /** Module ids whose declared permissions are all satisfied. */
  moduleIds: string[];
  /** Union of the capabilities declared by the satisfied modules. */
  capabilities: CapabilityKey[];
}



@Injectable()
export class WorkspacePermissionMapper {
  map(
    permissions: readonly string[],
    manifests: readonly ModuleManifest[],
  ): PermissionAccess {
    const allowed = new Set<string>(permissions);
    const moduleIds: string[] = [];
    const capabilities = new Set<CapabilityKey>();

    for (const manifest of manifests) {
      if (manifest.permissions.every((permission) => allowed.has(permission))) {
        moduleIds.push(manifest.id);
        for (const capability of manifest.capabilities) {
          capabilities.add(capability);
        }
      }
    }

    return {
      permissions: Array.from(allowed).sort(),
      moduleIds: moduleIds.sort(),
      capabilities: Array.from(capabilities).sort(),
    };
  }
}
