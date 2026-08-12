import { Injectable } from '@nestjs/common';

import { isLifecycleAware } from './lifecycle';

/** Thrown when a service name is already registered. */
export class ServiceAlreadyRegisteredError extends Error {
  constructor(name: string) {
    super(`Service "${name}" is already registered`);
    this.name = 'ServiceAlreadyRegisteredError';
  }
}

/** A registered service entry: its name plus the service instance. */
export interface ServiceEntry<T = unknown> {
  readonly name: string;
  readonly service: T;
}

/**
 * Minimal, DI-friendly service registry. Stores services keyed by name in
 * registration order and runs an idempotent lifecycle over lifecycle-aware
 * services (see `LifecycleAware`). No dynamic module loading.
 */
@Injectable()
export class ServiceRegistry {
  private readonly services = new Map<string, unknown>();
  private initialized = false;
  private shutdownDone = false;

  /** Registers a service. Throws on duplicate name. */
  register(name: string, service: unknown): void {
    if (this.services.has(name)) {
      throw new ServiceAlreadyRegisteredError(name);
    }
    this.services.set(name, service);
  }

  /** Returns the service for a name, or undefined when unknown. */
  get<T = unknown>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /** Returns true when a name is registered. */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /** Returns all registered services, in registration order. */
  list(): ServiceEntry[] {
    return Array.from(this.services, ([name, service]) => ({ name, service }));
  }

  /**
   * Initializes all lifecycle-aware services in registration order.
   * Safe to call once; subsequent calls are no-ops. Errors propagate.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    for (const { service } of this.list()) {
      if (isLifecycleAware(service)) {
        await service.initialize();
      }
    }
  }

  /**
   * Shuts down all lifecycle-aware services in reverse registration order.
   * Safe to call once; subsequent calls are no-ops. Errors propagate.
   */
  async shutdown(): Promise<void> {
    if (this.shutdownDone) return;
    this.shutdownDone = true;
    for (const { service } of this.list().reverse()) {
      if (isLifecycleAware(service) && service.shutdown) {
        await service.shutdown();
      }
    }
  }
}