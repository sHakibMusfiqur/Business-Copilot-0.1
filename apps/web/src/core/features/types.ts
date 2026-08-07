/** High-level category a feature belongs to. */
export type FeatureCategory =
  | 'platform'
  | 'business'
  | 'ai'
  | 'workflow'
  | 'automation'
  | 'reporting'
  | 'developer'
  | 'security'
  | 'administration'
  | 'integration'
  | 'plugin'
  | 'analytics'
  | 'infrastructure';

/** Lifecycle status of a feature in the catalog. */
export type FeatureStatus =
  | 'experimental'
  | 'preview'
  | 'beta'
  | 'stable'
  | 'deprecated'
  | 'internal'
  | 'hidden';

/** The scope a feature is exercised at. */
export type FeatureScope =
  | 'platform'
  | 'tenant'
  | 'organization'
  | 'workspace'
  | 'module'
  | 'user';

/** Static metadata attached to every feature definition. */
export interface FeatureMetadata {
  id: string;
  name: string;
  description?: string;
  category: FeatureCategory;
  scope: FeatureScope;
  status: FeatureStatus;
  version: string;
  owner?: string;
  experimental?: boolean;
  internal?: boolean;
  hidden?: boolean;
  deprecated?: boolean;
  tags?: readonly string[];
}

/**
 * Declarative feature definition — the Business OS feature catalog entry.
 * Links to existing engines: `capabilities` reference CapabilityKeys, and
 * `permissions`/`entitlements` reference the grant/plan strings the other
 * engines already consume. This is a catalog, never runtime toggle logic.
 */
export interface FeatureDefinition extends FeatureMetadata {
  /** Other feature ids this feature depends on being present. */
  dependencies?: readonly string[];
  /** Capability keys granted by this feature (align with CapabilityKey). */
  capabilities?: readonly string[];
  /** Permission grants this feature introduces. */
  permissions?: readonly string[];
  /** Entitlement keys this feature is gated behind. */
  entitlements?: readonly string[];
}

/** Resolved feature: definition + its fully-resolved dependency chain. */
export interface ResolvedFeature extends FeatureDefinition {
  /** Every feature this feature depends on, in dependency order. */
  dependencyChain: readonly string[];
}

/** Immutable snapshot of the entire catalog at a point in time. */
export interface FeatureSnapshot {
  version: string;
  takenAt: string;
  features: readonly ResolvedFeature[];
}
