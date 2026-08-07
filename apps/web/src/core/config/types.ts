export type ConfigScope =
  | 'platform'
  | 'environment'
  | 'tenant'
  | 'organization'
  | 'workspace'
  | 'module'
  | 'runtime'
  | 'feature';

/** Primitive config value. Config never carries objects — only typed scalars. */
export type ConfigValue = string | number | boolean | null;

/** Schema type used for validation. */
export type ConfigValueType = 'string' | 'number' | 'boolean';

/** Provenance of a resolved value. */
export type ConfigSource =
  | 'schema'
  | 'default'
  | 'environment'
  | 'override'
  | 'computed'
  | 'runtime';

/** Static metadata attached to every configuration entry. */
export interface ConfigMetadata {
  id: string;
  scope: ConfigScope;
  category: string;
  version: string;
  description?: string;
  default?: ConfigValue;
  /** Value is expected to change at runtime (injected via `setRuntime`). */
  runtime?: boolean;
  /** Cannot be overridden through `set`/`setRuntime`. */
  readonly?: boolean;
  internal?: boolean;
  experimental?: boolean;
  deprecated?: boolean;
  owner?: string;
  tags?: readonly string[];
}

/** Schema definition accepted by `define` — adds validation + computation. */
export interface ConfigDefinition extends Omit<ConfigMetadata, 'default'> {
  default?: ConfigValue;
  type?: ConfigValueType;
  validator?: (value: ConfigValue) => boolean;
  /** Computes a value from other resolved values. Runs last, wins the chain. */
  compute?: (values: ConfigValues) => ConfigValue | undefined;
}

/** Resolved entry: metadata + the final value and where it came from. */
export interface ConfigEntry extends ConfigMetadata {
  value: ConfigValue;
  source: ConfigSource;
}

/** Flat map of resolved config values by id. */
export type ConfigValues = Record<string, ConfigValue>;

/** Immutable snapshot of every resolved entry at a point in time. */
export interface ConfigSnapshot {
  version: string;
  takenAt: string;
  entries: ConfigEntry[];
}
