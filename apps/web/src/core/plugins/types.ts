import type { Command, CommandResult } from '../commands/types';
import type { Query, QueryResponse } from '../queries/types';
import type { EventHandler, Unsubscribe } from '../events/types';

/** Lifecycle status of a plugin. */
export type PluginStatus =
  | 'registered'
  | 'resolving'
  | 'initializing'
  | 'active'
  | 'inactive'
  | 'failed'
  | 'uninstalled';

/** Semantic version constraints (e.g. `>=1.2.0 <2.0.0`). */
export type VersionRange = string;

/** Metadata describing a plugin's identity, version and compatibility. */
export interface PluginManifest {
  /** Unique plugin id (reverse-domain style: `acme.billing`). */
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** Platform/Kernel version this plugin requires. */
  platformVersion?: VersionRange;
  /** SemVer ranges this plugin depends on, keyed by plugin id. */
  dependencies?: Readonly<Record<string, VersionRange>>;
  /** Opt-in capabilities the plugin exposes. */
  capabilities?: readonly string[];
  /** Optional entry points the loader invokes (lazy registration). */
  entry?: string;
  enabled?: boolean;
}

/** Lifecycle hooks invoked by the plugin runtime. */
export interface PluginHooks {
  install?: (context: PluginContext) => void | Promise<void>;
  activate?: (context: PluginContext) => void | Promise<void>;
  deactivate?: (context: PluginContext) => void | Promise<void>;
  uninstall?: (context: PluginContext) => void | Promise<void>;
}

/** A concrete plugin implementation: manifest + lifecycle hooks. */
export interface PluginDefinition extends PluginManifest, PluginHooks {}

/**
 * Runtime context handed to hook functions — grants access to the host
 * foundation (events, commands, queries) without leaking internal registries.
 */
export interface PluginContext {
  readonly pluginId: string;
  readonly eventBus: Readonly<{
    subscribe: (event: string, handler: EventHandler<unknown>) => Unsubscribe;
    publish: (event: string, payload: unknown) => Promise<void>;
  }>;
  readonly commands: Readonly<{
    register: (type: string, handler: (command: Command) => void | Promise<void>) => boolean;
    execute: (command: Command) => Promise<CommandResult>;
  }>;
  readonly queries: Readonly<{
    register: (type: string, handler: (query: Query) => QueryResponse | Promise<QueryResponse>) => boolean;
    execute: (query: Query) => Promise<QueryResponse>;
  }>;
  /** Record of resolved dependent plugin instances at the time of activation. */
  readonly dependencies: ReadonlyMap<string, PluginRecord>;
}

/** Runtime record a plugin holds once registered. */
export interface PluginMetadata extends PluginManifest {
  readonly status: PluginStatus;
  readonly registeredAt: string;
  readonly activatedAt?: string;
}

/** Public, implementation-free view of a registered plugin. */
export interface PluginRecord {
  readonly manifest: PluginManifest;
  readonly status: PluginStatus;
  readonly activatedAt?: string;
}

/** Result of a load/activation attempt. */
export interface PluginLoadResult {
  readonly id: string;
  readonly ok: boolean;
  readonly error?: string;
}

/** Immutable snapshot of the plugin registry. */
export interface PluginRegistrySnapshot {
  readonly pluginCount: number;
  readonly activeCount: number;
  readonly failedCount: number;
  readonly ids: readonly string[];
}