import { ModuleControllerRegistry } from './controller';
import { ModuleLifecycle } from './lifecycle';
import { moduleRegistry } from './registry';
import type {
  ModuleController,
  ModuleHealth,
  ModuleLifecycleStatus,
  ModuleRuntimeContext,
  ModuleRuntimeSnapshot,
} from './types';

interface RuntimeEntry {
  readonly lifecycle: ModuleLifecycle;
  readonly controller: ModuleController;
  readonly startedAt?: string;
}

/**
 * Module Engine — composes the {@link ModuleRegistry} (manifest catalog) with
 * the {@link ModuleControllerRegistry} (lazy controllers) and a strict per-module
 * lifecycle. It provides active-controlled startup/shutdown, dependency
 * health checks and live reload.
 */
export class ModuleEngine {
  readonly controllers: ModuleControllerRegistry;
  private readonly runtimes = new Map<string, RuntimeEntry>();

  constructor() {
    this.controllers = new ModuleControllerRegistry();
  }

  /** Whether a module manifest is registered in the catalog. */
  has(moduleId: string): boolean {
    return moduleRegistry.has(moduleId);
  }

  /**
   * Start a module (and, transitively, its registered dependencies first).
   * Rejects when a dependency is unavailable or the active controller throws.
   */
  async start(moduleId: string): Promise<void> {
    const manifest = moduleRegistry.get(moduleId);
    if (!manifest) throw new Error(`Module not registered: ${moduleId}`);

    for (const dependency of this.resolveDepOrder(moduleId)) {
      await this.startSingle(dependency);
    }

    if (this.runtimes.has(moduleId)) {
      const entry = this.runtimes.get(moduleId) as RuntimeEntry;
      if (entry.lifecycle.is('active')) return;
    }
    await this.startSingle(moduleId);
  }

  /** Stop a module and every module that depends on it. */
  async stop(moduleId: string): Promise<void> {
    for (const dependent of this.dependantsOf(moduleId)) {
      await this.stopSingle(dependent);
    }
    await this.stopSingle(moduleId);
  }

  /** Reload a module: stop + re-instantiate its controller, then start. */
  async reload(moduleId: string): Promise<void> {
    if (!this.runtimes.has(moduleId)) return;
    await this.stopSingle(moduleId);
    this.runtimes.delete(moduleId);
    await this.startSingle(moduleId);
  }

  async stopAll(): Promise<void> {
    for (const moduleId of [...this.runtimes.keys()]) {
      await this.stopSingle(moduleId);
    }
  }

  /** Health report for a single module. */
  health(moduleId: string): ModuleHealth {
    const entry = this.runtimes.get(moduleId);
    const status: ModuleLifecycleStatus = entry?.lifecycle.value ?? 'registered';
    const missingDeps = this.missingDependenciesOf(moduleId);
    const ok = status === 'active' && missingDeps.length === 0;
    const message =
      missingDeps.length > 0
        ? `Missing dependencies: ${missingDeps.join(', ')}`
        : status === 'failed'
          ? 'Module has failed'
          : undefined;

    return {
      moduleId,
      status,
      ok,
      message,
      depsResolved: this.resolvedDepsOf(moduleId),
      missingDeps,
      startedAt: entry?.startedAt,
    };
  }

  /** Snapshot of all registered modules. */
  snapshot(): ModuleRuntimeSnapshot {
    const modules = moduleRegistry.all().map((manifest) => this.health(manifest.id));
    return {
      moduleCount: modules.length,
      activeCount: modules.filter((module) => module.status === 'active').length,
      failedCount: modules.filter((module) => module.status === 'failed').length,
      modules,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async startSingle(moduleId: string): Promise<void> {
    const manifest = moduleRegistry.get(moduleId);
    if (!manifest) throw new Error(`Module not registered: ${moduleId}`);
    if (!this.controllers.has(moduleId)) {
      throw new Error(`No controller bound for module: ${moduleId}`);
    }

    const context = this.contextFor(moduleId);
    if (this.runtimes.has(moduleId)) {
      const existing = this.runtimes.get(moduleId) as RuntimeEntry;
      if (existing.lifecycle.is('active')) return;
      if (!existing.lifecycle.is('stopped') && !existing.lifecycle.is('failed')) {
        throw new Error(`Module is not in a startable state: ${moduleId}`);
      }
      existing.lifecycle.transition('starting');
      await existing.controller.start?.(context);
      existing.lifecycle.transition('active');
      return;
    }

    const lifecycle = new ModuleLifecycle();
    const controller = this.controllers.resolve(moduleId, context);
    lifecycle.transition('resolving');
    await controller.initialize?.(context);
    lifecycle.transition('loaded');
    lifecycle.transition('starting');
    await controller.start?.(context);
    lifecycle.transition('active');
    this.runtimes.set(moduleId, {
      lifecycle,
      controller,
      startedAt: new Date().toISOString(),
    });
  }

  private async stopSingle(moduleId: string): Promise<void> {
    const entry = this.runtimes.get(moduleId);
    if (!entry) return;
    if (entry.lifecycle.is('active')) {
      entry.lifecycle.transition('stopping');
      await entry.controller.stop?.(this.contextFor(moduleId));
      entry.lifecycle.transition('stopped');
    } else if (entry.lifecycle.is('starting')) {
      entry.lifecycle.transition('stopped');
    } else if (entry.lifecycle.is('failed')) {
      entry.lifecycle.force('stopped');
    }
  }

  /** Modules that depend (transitively) on the given module. */
  private dependantsOf(moduleId: string): string[] {
    const result: string[] = [];
    const visit = (candidate: string): void => {
      if (result.includes(candidate)) return;
      const manifest = moduleRegistry.get(candidate);
      if (manifest?.dependencies?.includes(moduleId)) {
        result.push(candidate);
      }
      for (const dep of moduleRegistry.all()) {
        if (dep.dependencies?.includes(candidate) && dep.id !== moduleId) {
          visit(dep.id);
        }
      }
    };
    for (const manifest of moduleRegistry.all()) {
      if (manifest.id !== moduleId) visit(manifest.id);
    }
    return result;
  }

  /** Topological dependency ordering (dependencies before dependants). */
  private resolveDepOrder(moduleId: string): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const manifest = moduleRegistry.get(id);
      for (const dep of manifest?.dependencies ?? []) {
        if (!moduleRegistry.has(dep)) continue;
        visit(dep);
      }
      order.push(id);
    };
    visit(moduleId);
    return order.slice(0, -1);
  }

  private resolvedDepsOf(moduleId: string): string[] {
    return (moduleRegistry.get(moduleId)?.dependencies ?? []).filter((dep) =>
      moduleRegistry.has(dep),
    );
  }

  private missingDependenciesOf(moduleId: string): string[] {
    return (moduleRegistry.get(moduleId)?.dependencies ?? []).filter(
      (dep) => !moduleRegistry.has(dep),
    );
  }

  private contextFor(moduleId: string): ModuleRuntimeContext {
    return {
      moduleId,
      moduleName: moduleRegistry.get(moduleId)?.name ?? moduleId,
    };
  }
}