import { PluginLifecycle } from './lifecycle';
import { satisfiesRange, PLUGIN_VERSION } from './metadata';
import type {
  PluginContext,
  PluginDefinition,
  PluginLoadResult,
  PluginRecord,
  PluginRegistrySnapshot,
  PluginStatus,
} from './types';

interface Host {
  readonly eventBus: PluginContext['eventBus'];
  readonly commands: PluginContext['commands'];
  readonly queries: PluginContext['queries'];
}

interface PluginEntry {
  readonly definition: PluginDefinition;
  readonly lifecycle: PluginLifecycle;
  readonly registeredAt: string;
  activatedAt?: string;
}

/**
 * Plugin Registry — registers, validates, orders, activates and deactivates
 * plugins. Dependency ordering is derived from `PluginManifest.dependencies`;
 * activation is topologically ordered and strictly lifecycled.
 */
export class PluginRegistry {
  private readonly entries = new Map<string, PluginEntry>();
  private readonly host: Host;

  constructor(host: Host) {
    this.host = host;
  }

  /** Register a plugin definition. Returns false when the id is taken. */
  register(definition: PluginDefinition): boolean {
    if (this.entries.has(definition.id)) return false;
    this.entries.set(definition.id, {
      definition,
      lifecycle: new PluginLifecycle(),
      registeredAt: new Date().toISOString(),
    });
    return true;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Missing plugin dependencies (not registered or unsatisfied version). */
  missingDependencies(id: string): string[] {
    const entry = this.entries.get(id);
    if (!entry) return [];
    return Object.entries(entry.definition.dependencies ?? {})
      .filter(([depId, range]) => {
        const dep = this.entries.get(depId);
        return !dep || !satisfiesRange(dep.definition.version, range);
      })
      .map(([depId]) => depId);
  }

  /** Detect dependency cycles via DFS; returns ids participating in a cycle. */
  detectCycles(): string[] {
    const inCycle = new Set<string>();
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (id: string): void => {
      if (visiting.has(id)) {
        const start = stack.indexOf(id);
        for (const node of stack.slice(start)) inCycle.add(node);
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      visited.add(id);
      stack.push(id);
      const entry = this.entries.get(id);
      for (const depId of Object.keys(entry?.definition.dependencies ?? {})) {
        if (this.entries.has(depId)) dfs(depId);
      }
      stack.pop();
      visiting.delete(id);
    };

    for (const id of this.entries.keys()) dfs(id);
    return [...inCycle];
  }

  /** Topologically order plugin ids (dependencies first). */
  private orderForActivation(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const entry = this.entries.get(id);
      for (const depId of Object.keys(entry?.definition.dependencies ?? {})) {
        if (this.entries.has(depId)) visit(depId);
      }
      order.push(id);
    };
    for (const id of this.entries.keys()) visit(id);
    return order;
  }

  /**
   * Activate a plugin (and, transitively, its registered dependencies in order).
   * Runs install/activate hooks with a per-plugin runtime context.
   */
  async activate(id: string): Promise<PluginLoadResult> {
    const entry = this.entries.get(id);
    if (!entry) return { id, ok: false, error: `Plugin not registered: ${id}` };

    const missing = this.missingDependencies(id);
    if (missing.length > 0) {
      return { id, ok: false, error: `Missing plugin dependencies: ${missing.join(', ')}` };
    }
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      return { id, ok: false, error: `Plugin dependency cycle: ${cycles.join(' -> ')}` };
    }

    const order = this.orderForActivation().filter((pid) => pid === id || this.pluginIsDependencyOf(id, pid));
    try {
      for (const pid of order) {
        const current = this.entries.get(pid);
        if (!current || current.lifecycle.is('active')) continue;
        await this.runLifecycle(current, pid);
      }
      return { id, ok: true };
    } catch (error) {
      return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Deactivate a plugin (and any plugins that depend on it). */
  async deactivate(id: string): Promise<PluginLoadResult> {
    const entry = this.entries.get(id);
    if (!entry) return { id, ok: false, error: `Plugin not registered: ${id}` };

    const dependants = [...this.entries.keys()].filter(
      (pid) => pid !== id && Object.keys(this.entries.get(pid)?.definition.dependencies ?? {}).includes(id),
    );
    for (const dependant of dependants) {
      await this.deactivate(dependant);
    }

    if (entry.lifecycle.is('active')) {
      try {
        await entry.definition.deactivate?.(this.contextFor(id));
        entry.lifecycle.transition('inactive');
      } catch (error) {
        return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    return { id, ok: true };
  }

  /** Uninstall a plugin and remove its registration. */
  async uninstall(id: string): Promise<PluginLoadResult> {
    await this.deactivate(id);
    const entry = this.entries.get(id);
    if (!entry) return { id, ok: false, error: `Plugin not registered: ${id}` };
    try {
      await entry.definition.uninstall?.(this.contextFor(id));
    } finally {
      entry.lifecycle.force('uninstalled');
      this.entries.delete(id);
    }
    return { id, ok: true };
  }

  status(id: string): PluginStatus | undefined {
    return this.entries.get(id)?.lifecycle.value;
  }

  record(id: string): PluginRecord | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    return {
      manifest: entry.definition,
      status: entry.lifecycle.value,
      activatedAt: entry.activatedAt,
    };
  }

  /** All registered plugins, as public records. */
  list(): PluginRecord[] {
    return [...this.entries.keys()].map((id) => this.record(id) as PluginRecord);
  }

  snapshot(): PluginRegistrySnapshot {
    const records = this.list();
    return {
      pluginCount: records.length,
      activeCount: records.filter((record) => record.status === 'active').length,
      failedCount: records.filter((record) => record.status === 'failed').length,
      ids: records.map((record) => record.manifest.id),
    };
  }

  /** Highest registered plugin version, or undefined when empty. */
  latestVersion(id: string): string | undefined {
    const entry = this.entries.get(id);
    return entry?.definition.version;
  }

  get version(): string {
    return PLUGIN_VERSION;
  }

  private pluginIsDependencyOf(target: string, candidate: string): boolean {
    const entry = this.entries.get(candidate);
    return Object.keys(entry?.definition.dependencies ?? {}).includes(target);
  }

  private contextFor(id: string): PluginContext {
    const dependencies = new Map<string, PluginRecord>();
    for (const depId of Object.keys(this.entries.get(id)?.definition.dependencies ?? {})) {
      const record = this.record(depId);
      if (record) dependencies.set(depId, record);
    }
    return { pluginId: id, eventBus: this.host.eventBus, commands: this.host.commands, queries: this.host.queries, dependencies };
  }

  private async runLifecycle(entry: PluginEntry, id: string): Promise<void> {
    entry.lifecycle.transition('resolving');
    await entry.definition.install?.(this.contextFor(id));
    entry.lifecycle.transition('initializing');
    await entry.definition.activate?.(this.contextFor(id));
    entry.lifecycle.transition('active');
    entry.activatedAt = new Date().toISOString();
  }
}

/** Static SemVer helpers surfaced alongside the registry. */
export { compareVersions, satisfiesRange } from './metadata';