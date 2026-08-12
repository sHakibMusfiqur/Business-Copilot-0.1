import { Injectable } from '@nestjs/common';

import type { ModuleManifest } from '@bc/core';

import { ModuleRegistry } from './module-registry';

@Injectable()
export class KernelService {
  constructor(readonly registry: ModuleRegistry) {}

  /** Registers a module manifest. Throws on duplicate id. */
  registerModule(manifest: ModuleManifest): void {
    this.registry.register(manifest);
  }

  /** Returns true when a module id is registered. */
  hasModule(id: string): boolean {
    return this.registry.has(id);
  }

  /** Returns the manifest for an id, or undefined when unknown. */
  getModule(id: string): ModuleManifest | undefined {
    return this.registry.get(id);
  }

  /** Returns an array of all registered manifests. */
  listModules(): ModuleManifest[] {
    return this.registry.list();
  }
}