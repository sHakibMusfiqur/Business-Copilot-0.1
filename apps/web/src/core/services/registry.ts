import { RESERVED_SERVICES, SERVICE_CATEGORIES } from './metadata';
import { ServiceLifecycle } from './lifecycle';
import type {
  ServiceCategory,
  ServiceDescriptor,
  ServiceDefinition,
  ServiceHealth,
  ServiceRecord,
  ServiceStatus,
} from './types';

/** Internal registration record — implementation never leaves the registry. */
interface ServiceEntry<T extends object> extends ServiceDescriptor {
  factory: () => T;
  singleton: boolean;
  lifecycle: ServiceLifecycle;
  instance?: T;
  scopeKind: 'value' | 'factory';
}

function createHealth(status: 'ok' | 'degraded' | 'unknown'): ServiceHealth {
  return { status, checkedAt: new Date().toISOString() };
}

/** Normalizes a definition into a provider closure, or undefined when invalid. */
function createFactory<T>(definition: ServiceDefinition<T>): (() => T) | undefined {
  if (definition.value !== undefined) {
    return () => definition.value as T;
  }
  if (typeof definition.factory === 'function') {
    return definition.factory;
  }
  return undefined;
}

/**
 * Enterprise Service Registry — the central catalogue for discovering,
 * registering and resolving platform services. It is NOT a dependency injection
 * container: it manages service lifecycle, scopes and health, then hands back
 * resolved instances. No implementation details leak outside the registry.
 */
export class ServiceRegistry {
  private readonly entries = new Map<string, ServiceEntry<object>>();

  /** Registers a service. Returns false when the id is already registered or
   *  the definition has no usable provider. Self-dependencies are rejected. */
  register<T extends object>(definition: ServiceDefinition<T>): boolean {
    if (this.entries.has(definition.id)) return false;
    // A service cannot depend on itself — would be an unresolvable cycle.
    if (definition.dependencies?.includes(definition.id)) return false;
    const factory = createFactory(definition);
    if (!factory) return false;

    const scopeKind = definition.value !== undefined ? 'value' : 'factory';
    const lifecycle = new ServiceLifecycle();
    if (scopeKind === 'value') {
      lifecycle.force('ready');
    }

    this.entries.set(definition.id, {
      id: definition.id,
      name: definition.name,
      category: definition.category,
      version: definition.version,
      description: definition.description,
      owner: definition.owner,
      dependencies: definition.dependencies,
      scope: definition.scope ?? 'singleton',
      lazy: definition.lazy ?? scopeKind === 'factory',
      experimental: definition.experimental,
      internal: definition.internal,
      tags: definition.tags,
      factory,
      singleton: scopeKind === 'value' || definition.scope !== 'transient',
      instance: scopeKind === 'value' ? (definition.value as T) : undefined,
      lifecycle,
      scopeKind,
    });

    return true;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  isRegistered(id: string): boolean {
    return this.entries.has(id);
  }

  isResolvable(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    return !entry.lifecycle.is('disabled') && !entry.lifecycle.is('failed');
  }

  /** Looks up a service, resolving it on demand. Returns undefined when absent,
   *  reserved or in a blocked state. */
  get<T extends object>(id: string): T | undefined {
    const entry = this.entries.get(id);
    if (!entry || !this.isResolvable(id)) return undefined;
    if (entry.singleton && entry.instance !== undefined) {
      return entry.instance as T;
    }
    return this.instantiate<T>(entry);
  }

  /** Resolves a service, throwing when it cannot be provided. */
  resolve<T extends object>(id: string): T {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Platform service not registered: ${id}`);
    }
    if (!this.isResolvable(id)) {
      throw new Error(`Platform service not resolvable (${this.status(id)}): ${id}`);
    }
    if (entry.singleton && entry.instance !== undefined) {
      return entry.instance as T;
    }
    return this.instantiate<T>(entry);
  }

  private instantiate<T extends object>(entry: ServiceEntry<object>): T {
    if (entry.lifecycle.value === 'registered') {
      entry.lifecycle.transition('initializing');
    }
    try {
      const instance = entry.factory() as T;
      if (entry.singleton) {
        entry.instance = instance;
      }
      if (!entry.lifecycle.is('ready')) {
        entry.lifecycle.transition('ready');
      }
      return instance;
    } catch (error) {
      entry.lifecycle.transition('failed');
      throw error;
    }
  }

  private healthOf(entry: ServiceEntry<object>): ServiceHealth {
    const value = entry.lifecycle.value;
    if (value === 'ready') return createHealth('ok');
    if (value === 'failed') return createHealth('degraded');
    return createHealth('unknown');
  }

  /** Public descriptor view — no implementation is exposed. */
  describe(id: string): ServiceRecord | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      version: entry.version,
      description: entry.description,
      owner: entry.owner,
      dependencies: entry.dependencies,
      scope: entry.scope,
      lazy: entry.lazy,
      experimental: entry.experimental,
      internal: entry.internal,
      tags: entry.tags,
      status: entry.lifecycle.value,
      health: this.healthOf(entry),
    };
  }

  /** Catalog of all registered services (descriptors only). */
  list(): ServiceDescriptor[] {
    return Array.from(this.entries.values()).map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      version: entry.version,
      description: entry.description,
      owner: entry.owner,
      dependencies: entry.dependencies,
      scope: entry.scope,
      lazy: entry.lazy,
      experimental: entry.experimental,
      internal: entry.internal,
      tags: entry.tags,
    }));
  }

  byCategory(category: ServiceCategory): ServiceDescriptor[] {
    return this.list().filter((service) => service.category === category);
  }

  categories(): readonly ServiceCategory[] {
    return SERVICE_CATEGORIES;
  }

  dependenciesResolved(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    return (entry.dependencies ?? []).every((dep) => this.entries.has(dep));
  }

  /** Lists declared dependencies that are not yet registered. */
  missingDependencies(id: string): string[] {
    const entry = this.entries.get(id);
    if (!entry) return [];
    return (entry.dependencies ?? []).filter((dep) => !this.entries.has(dep));
  }

  /**
   * Verifies the entire dependency graph: every declared dependency must be
   * registered and the graph must be acyclic. Returns the ids whose dependency
   * contract is violated, or an empty array when the graph is valid.
   */
  validate(): string[] {
    const violated = new Set<string>();
    for (const [id, entry] of this.entries) {
      for (const dep of entry.dependencies ?? []) {
        if (!this.entries.has(dep)) {
          violated.add(id);
        }
      }
    }
    for (const id of this.detectCycles()) violated.add(id);
    return [...violated];
  }

  /** Detects dependency cycles via DFS; returns the ids participating in one. */
  detectCycles(): string[] {
    const inCycle = new Set<string>();
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (id: string, stack: string[]): void => {
      if (visiting.has(id)) {
        const start = stack.indexOf(id);
        const cycle = start === -1 ? stack : stack.slice(start);
        for (const node of cycle) inCycle.add(node);
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      visited.add(id);
      stack.push(id);
      const entry = this.entries.get(id);
      for (const dep of entry?.dependencies ?? []) {
        if (this.entries.has(dep)) dfs(dep, stack);
      }
      stack.pop();
      visiting.delete(id);
    };

    for (const id of this.entries.keys()) dfs(id, []);
    return [...inCycle];
  }

  status(id: string): ServiceStatus | undefined {
    return this.entries.get(id)?.lifecycle.value;
  }

  health(id: string): ServiceHealth | undefined {
    const entry = this.entries.get(id);
    return entry ? this.healthOf(entry) : undefined;
  }

  setStatus(id: string, status: ServiceStatus): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    if (entry.lifecycle.canTransition(status)) {
      entry.lifecycle.transition(status);
    } else {
      entry.lifecycle.force(status);
    }
    // A blocked factory service drops its cached instance so a fresh one is
    // created when the service becomes resolvable again.
    if ((status === 'disabled' || status === 'failed') && entry.scopeKind === 'factory') {
      entry.instance = undefined;
    }
    return true;
  }

  markReady(id: string): boolean {
    return this.setStatus(id, 'ready');
  }

  markFailed(id: string): boolean {
    return this.setStatus(id, 'failed');
  }

  disable(id: string): boolean {
    return this.setStatus(id, 'disabled');
  }

  deprecate(id: string): boolean {
    return this.setStatus(id, 'deprecated');
  }

  isReserved(id: string): boolean {
    return RESERVED_SERVICES.some((service) => service.id === id);
  }
}