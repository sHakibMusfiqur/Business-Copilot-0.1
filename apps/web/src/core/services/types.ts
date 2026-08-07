/** Functional category of a registered service. */
export type ServiceCategory =
  | 'core'
  | 'platform'
  | 'infrastructure'
  | 'application'
  | 'shared'
  | 'plugin'
  | 'ai'
  | 'integration';

/** Lifecycle status of a registered service. */
export type ServiceStatus =
  | 'registered'
  | 'initializing'
  | 'ready'
  | 'failed'
  | 'disabled'
  | 'deprecated';

/** Lifetime behaviour applied when the service is resolved. */
export type ServiceScope = 'singleton' | 'transient';

/** Service health verdict. */
export type ServiceHealthStatus = 'ok' | 'degraded' | 'unknown';

/** Health snapshot for a registered service. */
export interface ServiceHealth {
  status: ServiceHealthStatus;
  message?: string;
  checkedAt: string;
}

/** Static service identity + metadata (never mutates after registration). */
export interface ServiceDescriptor {
  id: string;
  name: string;
  category: ServiceCategory;
  version: string;
  description?: string;
  owner?: string;
  dependencies?: readonly string[];
  scope: ServiceScope;
  /** Whether resolution is deferred (all factory services are lazy). */
  lazy?: boolean;
  experimental?: boolean;
  internal?: boolean;
  tags?: readonly string[];
  reserved?: boolean;
}

/** Public view of a registered service: descriptor + dynamic status/health. */
export interface ServiceRecord extends ServiceDescriptor {
  status: ServiceStatus;
  health: ServiceHealth;
}

/**
 * Service definition accepted by `register`. A service carries either a
 * prebuilt `value` (shared instance) or a `factory` (instantiated lazily per
 * its scope on first resolve). Transient factories yield a fresh instance on
 * every resolve.
 */
export interface ServiceDefinition<T = unknown> {
  id: string;
  name: string;
  category: ServiceCategory;
  version: string;
  description?: string;
  owner?: string;
  dependencies?: readonly string[];
  scope?: ServiceScope;
  lazy?: boolean;
  experimental?: boolean;
  internal?: boolean;
  tags?: readonly string[];
  value?: T;
  factory?: () => T;
}

/** Catalog entry for a service a future phase will implement (reserved only). */
export interface ReservedService {
  id: string;
  name: string;
  category: ServiceCategory;
}