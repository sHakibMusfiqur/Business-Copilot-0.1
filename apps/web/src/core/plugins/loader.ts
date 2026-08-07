import type { PluginRegistry } from './registry';
import type { PluginDefinition, PluginLoadResult, PluginManifest } from './types';

/** Result of a registry validation run. */
export interface PluginValidationReport {
  readonly ok: boolean;
  readonly missingId: boolean;
  readonly duplicateIds: string[];
  readonly invalidVersion: string[];
  readonly missingDependencies: string[];
  readonly cycleIds: string[];
}


export class PluginLoader {
  readonly registry: PluginRegistry;

  constructor(registry: PluginRegistry) {
    this.registry = registry;
  }

  /** Validate a batch of manifests without mutating the registry. */
  validateBatch(manifests: readonly PluginManifest[]): PluginValidationReport {
    const seen = new Map<string, PluginManifest>();
    const duplicateIds: string[] = [];
    const invalidVersion: string[] = [];

    for (const manifest of manifests) {
      if (seen.has(manifest.id)) duplicateIds.push(manifest.id);
      seen.set(manifest.id, manifest);
      if (!/^\d+\.\d+\.\d+/.test(manifest.version)) invalidVersion.push(manifest.id);
    }

    const registeredIds = new Set([...this.registry.list().map((r) => r.manifest.id), ...seen.keys()]);
    const missingDependencies: string[] = [];
    for (const manifest of manifests) {
      for (const depId of Object.keys(manifest.dependencies ?? {})) {
        if (!registeredIds.has(depId)) missingDependencies.push(depId);
      }
    }

    const cycleIds = this.registry.detectCycles();
    return {
      ok:
        manifestHasId(manifests) &&
        duplicateIds.length === 0 &&
        invalidVersion.length === 0 &&
        missingDependencies.length === 0 &&
        cycleIds.length === 0,
      missingId: !manifestHasId(manifests),
      duplicateIds,
      invalidVersion,
      missingDependencies,
      cycleIds,
    };
  }

  /**
   * Register a batch, then activate every enabled plugin. Returns one
   * result per plugin id.
   */
  async loadBatch(definitions: readonly PluginDefinition[]): Promise<PluginLoadResult[]> {
    const report = this.validateBatch(definitions);
    if (!report.ok) {
      return definitions.map((definition) => ({
        id: definition.id,
        ok: false,
        error: compactValidationError(report),
      }));
    }

    const registered: string[] = [];
    for (const definition of definitions) {
      if (this.registry.register(definition)) registered.push(definition.id);
    }

    const results: PluginLoadResult[] = [];
    for (const id of registered) {
      const definition = definitions.find((d) => d.id === id);
      if (definition?.enabled === false) {
        results.push({ id, ok: true });
        continue;
      }
      results.push(await this.registry.activate(id));
    }
    return results;
  }
}

function manifestHasId(manifests: readonly PluginManifest[]): boolean {
  return manifests.every((manifest) => typeof manifest.id === 'string' && manifest.id.length > 0);
}

function compactValidationError(report: PluginValidationReport): string {
  const parts: string[] = [];
  if (report.missingId) parts.push('missing plugin id');
  if (report.duplicateIds.length) parts.push(`duplicate ids: ${report.duplicateIds.join(', ')}`);
  if (report.invalidVersion.length) parts.push(`invalid versions: ${report.invalidVersion.join(', ')}`);
  if (report.missingDependencies.length) parts.push(`missing deps: ${report.missingDependencies.join(', ')}`);
  if (report.cycleIds.length) parts.push(`cycles: ${report.cycleIds.join(' -> ')}`);
  return parts.join('; ');
}