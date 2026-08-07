/** The species of an identifier — what the identity denotes. */
export type IdentityKind =
  | 'engine'
  | 'service'
  | 'module'
  | 'feature'
  | 'capability'
  | 'permission'
  | 'config'
  | 'token'
  | 'logger'
  | 'error'
  | 'plugin'
  | 'workflow'
  | 'automation'
  | 'notification'
  | 'integration'
  | 'ai'
  | 'scheduler'
  | 'storage'
  | 'search'
  | 'route'
  | 'widget'
  | 'command'
  | 'dashboard';

/**
 * Canonical namespace for a group of identities. Hierarchical, dotted type
 * (e.g. `platform.engine.*`); each entry carries a single top-level namespace.
 */
export type IdentityNamespace =
  | 'platform.engine'
  | 'platform.service'
  | 'platform.module'
  | 'platform.feature'
  | 'platform.capability'
  | 'platform.permission'
  | 'platform.config'
  | 'platform.token'
  | 'platform.logger'
  | 'platform.error'
  | 'platform.plugin'
  | 'platform.workflow'
  | 'platform.automation'
  | 'platform.notification'
  | 'platform.integration'
  | 'platform.ai'
  | 'platform.scheduler'
  | 'platform.storage'
  | 'platform.search'
  | 'platform.route'
  | 'platform.widget'
  | 'platform.command'
  | 'platform.dashboard';

/** The default namespace for each identity kind. */
export const DEFAULT_NAMESPACE_BY_KIND: Record<IdentityKind, IdentityNamespace> = {
  engine: 'platform.engine',
  service: 'platform.service',
  module: 'platform.module',
  feature: 'platform.feature',
  capability: 'platform.capability',
  permission: 'platform.permission',
  config: 'platform.config',
  token: 'platform.token',
  logger: 'platform.logger',
  error: 'platform.error',
  plugin: 'platform.plugin',
  workflow: 'platform.workflow',
  automation: 'platform.automation',
  notification: 'platform.notification',
  integration: 'platform.integration',
  ai: 'platform.ai',
  scheduler: 'platform.scheduler',
  storage: 'platform.storage',
  search: 'platform.search',
  route: 'platform.route',
  widget: 'platform.widget',
  command: 'platform.command',
  dashboard: 'platform.dashboard',
};

/** Immutable metadata attached to every identity. */
export interface IdentityMetadata {
  /** Globally unique, namespace-qualified id (e.g. `platform.engine.kernel`). */
  id: string;
  /** Human-readable display name. */
  name: string;
  kind: IdentityKind;
  namespace: IdentityNamespace;
  /** The engine-local id this identity refers to (e.g. `dashboard`). */
  ref: string;
  description?: string;
  version: string;
  owner?: string;
  internal?: boolean;
  experimental?: boolean;
  deprecated?: boolean;
  tags?: readonly string[];
}

/** A registered identity. */
export type IdentityEntry = IdentityMetadata;

/** Immutable snapshot of the identity registry at a point in time. */
export interface IdentitySnapshot {
  version: string;
  takenAt: string;
  identities: readonly IdentityEntry[];
}

/** Input accepted by `register`. */
export type IdentityInput = Omit<IdentityMetadata, 'id'> & {
  id: string;
};