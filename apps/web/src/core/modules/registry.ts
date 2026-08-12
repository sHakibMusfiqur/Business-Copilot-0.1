import type { CapabilityKey } from '@bc/core';

import { MODULE_CATEGORIES } from './categories';
import { MODULE_MANIFESTS } from './definitions';
import type { ModuleCategory, ModuleManifest } from './types';

export class ModuleRegistry {
  private readonly byId = new Map<string, ModuleManifest>();

  register(manifest: ModuleManifest): void {
    this.byId.set(manifest.id, manifest);
  }

  registerAll(manifests: ModuleManifest[]): void {
    for (const manifest of manifests) {
      this.register(manifest);
    }
  }

  get(id: string): ModuleManifest | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): ModuleManifest[] {
    return Array.from(this.byId.values());
  }

  byCategory(category: ModuleCategory): ModuleManifest[] {
    return this.all().filter((m) => m.category === category);
  }

  byCapability(capability: CapabilityKey): ModuleManifest[] {
    return this.all().filter((m) => m.capabilities.includes(capability));
  }


  resolveDependencies(id: string): ModuleManifest[] {
    const seen = new Set<string>([id]);
    const queue = [...(this.get(id)?.dependencies ?? [])];
    const resolved: ModuleManifest[] = [];
    while (queue.length > 0) {
      const depId = queue.shift() as string;
      if (seen.has(depId)) continue;
      seen.add(depId);
      const dep = this.get(depId);
      if (!dep) continue;
      resolved.push(dep);
      queue.push(...(dep.dependencies ?? []));
    }
    return resolved;
  }

  categories(): readonly ModuleCategory[] {
    return MODULE_CATEGORIES;
  }
}

/** Default kernel-wide registry pre-populated with the built-in modules. */
export const moduleRegistry = new ModuleRegistry();
moduleRegistry.registerAll(MODULE_MANIFESTS);
