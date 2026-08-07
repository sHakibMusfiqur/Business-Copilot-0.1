import { CONFIG_SCOPE_RANK, CONFIG_SCOPE_ORDER } from './constants';
import { DEFAULT_CONFIG } from './metadata';
import { ConfigReadonlyError, ConfigNotFoundError, ConfigComputationError } from './errors';
import { buildBaseValues, resolveScopedOverride, type ConfigStore } from './resolver';
import { assertValidator, assertValueType, isEnvironmentScope } from './validation';
import type {
  ConfigDefinition,
  ConfigEntry,
  ConfigScope,
  ConfigSnapshot,
  ConfigSource,
  ConfigValue,
  ConfigValues,
} from './types';

export type { ConfigScope };


export class ConfigEngine {
  private readonly definitions = new Map<string, ConfigDefinition>();
  private readonly store: ConfigStore = {
    overrides: new Map(),
    environment: new Map(),
    runtime: new Map(),
  };

  constructor(definitions: readonly ConfigDefinition[] = DEFAULT_CONFIG) {
    for (const definition of definitions) {
      this.define(definition);
    }
  }

  // ── Definition / metadata ─────────────────────────────────────────────────

  /** Register or replace a config definition. */
  define(definition: ConfigDefinition): void {
    this.definitions.set(definition.id, { ...definition });
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  /** Full metadata for an id — throws when unknown. */
  describe(id: string): ConfigDefinition {
    return this.definitions.get(id) ?? (() => { throw new ConfigNotFoundError(id); })();
  }

  /** Scope the entry is declared under. */
  scope(id: string): ConfigScope {
    return this.describe(id).scope;
  }

  keys(): string[] {
    return [...this.definitions.keys()];
  }

  // ── Value layers ──────────────────────────────────────────────────────────

  /** Override a value under a scope (defaults to its declared scope). */
  set(id: string, value: ConfigValue, scope?: ConfigScope): void {
    const definition = this.describe(id);
    this.assertWritable(id, definition);

    const targetScope = scope ?? definition.scope;
    if (targetScope === 'feature') {
      // feature is an override-level concept, stored as an override
      this.writeOverride(id, value, targetScope, 'override');
      return;
    }

    if (isEnvironmentScope(targetScope)) {
      assertValueType(value, definition.type, id);
      assertValidator(value, definition);
      this.store.environment.set(id, { value, source: 'environment' });
      return;
    }

    this.writeOverride(id, value, targetScope, 'override');
  }

  /** Inject a runtime value for a runtime-flagged (or normally mutable) entry. */
  setRuntime(id: string, value: ConfigValue): void {
    const definition = this.describe(id);
    this.assertWritable(id, definition);
    if (definition.runtime !== true && definition.scope !== 'runtime') {
      throw new ConfigReadonlyError(id);
    }
    assertValueType(value, definition.type, id);
    assertValidator(value, definition);
    this.store.runtime.set(id, { value, source: 'runtime' });
  }

  // ── Resolution ────────────────────────────────────────────────────────────

  /** Resolve an id to its final value — throws when unknown. */
  get(id: string): ConfigValue {
    return this.resolve(id).value;
  }

  /** Resolve an id, returning undefined when unknown. */
  getIf(id: string): ConfigValue | undefined {
    const definition = this.definitions.get(id);
    if (!definition) {
      return undefined;
    }
    const resolved = this.resolveEntry(definition.id);
    return resolved?.value;
  }

  /** Full resolved entry (metadata + value + source) for an id. */
  resolve(id: string): ConfigEntry {
    const definition = this.describe(id);
    const entry = this.resolveEntry(definition.id);
    if (!entry) {
      throw new ConfigNotFoundError(id);
    }
    return entry;
  }

  /** Immutable snapshot of every known entry at this instant. */
  snapshot(): ConfigSnapshot {
    const base = this.buildFullValues();
    const entries: ConfigEntry[] = [];
    for (const id of this.definitions.keys()) {
      const definition = this.definitions.get(id);
      if (!definition) {
        continue;
      }
      if (typeof definition.compute === 'function') {
        let value: ConfigValue | undefined;
        try {
          value = definition.compute(base.values);
        } catch (error) {
          throw new ConfigComputationError(id, error instanceof Error ? error.message : undefined);
        }
        if (value === undefined) {
          throw new ConfigComputationError(id, 'compute callback returned no value.');
        }
        entries.push({ ...definition, value, source: 'computed' });
      } else {
        const entry = this.resolveEntry(id);
        if (entry) {
          entries.push(entry);
        }
      }
    }
    return {
      version: '1.0.0',
      takenAt: new Date().toISOString(),
      entries,
    };
  }

  /** Flatten snapshot values into a ConfigValues map. */
  values(snapshot: ConfigSnapshot): ConfigValues {
    const values: ConfigValues = {};
    for (const entry of snapshot.entries) {
      values[entry.id] = entry.value;
    }
    return values;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private assertWritable(id: string, definition: ConfigDefinition): void {
    if (definition.readonly === true) {
      throw new ConfigReadonlyError(id);
    }
  }

  private writeOverride(id: string, value: ConfigValue, scope: ConfigScope, source: ConfigSource): void {
    assertValueType(value, this.definitions.get(id)?.type, id);
    const definition = this.definitions.get(id);
    if (definition) {
      assertValidator(value, definition);
    }
    let bucket = this.store.overrides.get(scope);
    if (!bucket) {
      bucket = new Map();
      this.store.overrides.set(scope, bucket);
    }
    bucket.set(id, { value, source });
  }

  /** Resolve a single, non-computed entry. */
  private resolveEntry(id: string): ConfigEntry | undefined {
    const definition = this.definitions.get(id);
    if (!definition) {
      return undefined;
    }
    if (typeof definition.compute === 'function') {
      // computed values are produced during snapshot(); a lone resolve returns
      // the computed result on a standalone base to keep `get` consistent.
      const base = this.buildFullValues();
      let value: ConfigValue | undefined;
      try {
        value = definition.compute(base.values);
      } catch (error) {
        throw new ConfigComputationError(id, error instanceof Error ? error.message : undefined);
      }
      if (value === undefined) {
        throw new ConfigComputationError(id, 'compute callback returned no value.');
      }
      return { ...definition, value, source: 'computed' };
    }

    const overridden = resolveScopedOverride(this.store, id);
    if (overridden) {
      return { ...definition, value: overridden.value, source: overridden.source };
    }
    return { ...definition, value: definition.default ?? null, source: definition.default === undefined ? 'schema' : 'default' };
  }

  /** Build every value (defaults + overrides + environment + runtime) once. */
  private buildFullValues(): { values: ConfigValues } {
    const values = buildBaseValues(
      this.store,
      (id) => this.definitions.get(id)?.default,
      (id) => this.definitions.has(id),
    );
    return { values };
  }
}

/** Convenience: compare two scopes by precedence. */
export function isHigherScope(a: ConfigScope, b: ConfigScope): boolean {
  return CONFIG_SCOPE_RANK[a] > CONFIG_SCOPE_RANK[b];
}

export { CONFIG_SCOPE_ORDER };