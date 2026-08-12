import { Injectable } from '@nestjs/common';

import type { ModuleManifest } from '@bc/core';

/** Thrown when a module id is already registered. */
export class ModuleAlreadyRegisteredError extends Error {
  constructor(moduleId: string) {
    super(`Module "${moduleId}" is already registered`);
    this.name = 'ModuleAlreadyRegisteredError';
  }
}


@Injectable()
export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleManifest>();

  /** Registers a module manifest. Throws on duplicate id. */
  register(manifest: ModuleManifest): void {
    if (this.modules.has(manifest.id)) {
      throw new ModuleAlreadyRegisteredError(manifest.id);
    }
    this.modules.set(manifest.id, manifest);
  }

  /** Returns the manifest for an id, or undefined when unknown. */
  get(id: string): ModuleManifest | undefined {
    return this.modules.get(id);
  }

  /** Returns true when an id is registered. */
  has(id: string): boolean {
    return this.modules.has(id);
  }

  /** Returns an array of all registered manifests. */
  list(): ModuleManifest[] {
    return Array.from(this.modules.values());
  }
}