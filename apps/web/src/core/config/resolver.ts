import { CONFIG_SCOPE_RANK } from './constants';
import type { ConfigScope, ConfigSource, ConfigValue } from './types';

/** A single stored value entry inside a scope bucket. */
export interface StoredValue {
  value: ConfigValue;
  source: ConfigSource;
}

/** Layered, scope-keyed store that backs the engine. */
export interface ConfigStore {
  /** Overrides grouped by the scope they were set under. */
  overrides: Map<ConfigScope, Map<string, StoredValue>>;
  /** Environment-sourced values (acts as the `environment` scope layer). */
  environment: Map<string, StoredValue>;
  /** Runtime values (acts as the `runtime` scope layer). */
  runtime: Map<string, StoredValue>;
}

/** Pick the highest-precedence override across all scopes for an id. */
export function resolveScopedOverride(
  store: ConfigStore,
  id: string,
  exclude?: ReadonlySet<ConfigScope>,
): { value: ConfigValue; scope: ConfigScope; source: ConfigSource } | undefined {
  let best: { value: ConfigValue; scope: ConfigScope; source: ConfigSource } | undefined;

  const consider = (scope: ConfigScope, stored: StoredValue) => {
    if (exclude && exclude.has(scope)) {
      return;
    }
    if (!best || CONFIG_SCOPE_RANK[scope] > CONFIG_SCOPE_RANK[best.scope]) {
      best = { value: stored.value, scope, source: stored.source };
    }
  };

  store.overrides.forEach((bucket, scope) => {
    const stored = bucket.get(id);
    if (stored) {
      consider(scope, stored);
    }
  });

  const env = store.environment.get(id);
  if (env) {
    consider('environment', env);
  }

  const runtime = store.runtime.get(id);
  if (runtime) {
    consider('runtime', runtime);
  }

  return best;
}

/** Whether the id has any stored value in any scope/override bucket it can see. */
export function hasStoredValue(store: ConfigStore, id: string): boolean {
  let found = false;
  store.overrides.forEach((bucket) => {
    if (bucket.has(id)) {
      found = true;
    }
  });
  return found || store.environment.has(id) || store.runtime.has(id);
}

/** Compute base values (id -> value) for the non-computed entries. */
export function buildBaseValues(
  store: ConfigStore,
  defaultOf: (id: string) => ConfigValue | undefined,
  hasDefinition: (id: string) => boolean,
): Record<string, ConfigValue> {
  const values: Record<string, ConfigValue> = {};
  const produced = new Set<string>();

  // Enumerate every known id first (defaults appear only when defined).
  store.overrides.forEach((bucket) => bucket.forEach((stored, id) => collect(id)));
  store.environment.forEach((stored, id) => collect(id));
  store.runtime.forEach((stored, id) => collect(id));

  function collect(id: string): void {
    if (produced.has(id)) {
      return;
    }
    produced.add(id);
    if (!hasDefinition(id)) {
      return;
    }
    const resolved = resolveScopedOverride(store, id);
    if (resolved) {
      values[id] = resolved.value;
    } else {
      const fallback = defaultOf(id);
      values[id] = fallback ?? null;
    }
  }

  return values;
}