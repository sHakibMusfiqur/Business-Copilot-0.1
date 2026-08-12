import { Injectable } from '@nestjs/common';

import type { ModuleManifest } from '@bc/core';

import { ModuleRegistry } from './module-registry';
import { ServiceRegistry, type ServiceEntry } from './service-registry';


@Injectable()
export class KernelService {
  constructor(
    readonly registry: ModuleRegistry,
    readonly services: ServiceRegistry,
  ) {}

  // --- Modules ---

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

  // --- Services ---

  /** Registers a service. Throws on duplicate name. */
  registerService(name: string, service: unknown): void {
    this.services.register(name, service);
  }

  /** Returns the service for a name, or undefined when unknown. */
  getService<T = unknown>(name: string): T | undefined {
    return this.services.get<T>(name);
  }

  /** Returns true when a service name is registered. */
  hasService(name: string): boolean {
    return this.services.has(name);
  }

  /** Returns all registered services, in registration order. */
  listServices(): ServiceEntry[] {
    return this.services.list();
  }

  // --- Lifecycle ---

  /** Initializes lifecycle-aware services in registration order. */
  async initialize(): Promise<void> {
    return this.services.initialize();
  }

  /** Shuts down lifecycle-aware services in reverse registration order. */
  async shutdown(): Promise<void> {
    return this.services.shutdown();
  }
}