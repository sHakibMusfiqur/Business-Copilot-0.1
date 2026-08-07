import { ALL_FEATURES } from '../catalog';
import {
  FEATURE_REGISTRY_VERSION,
  describeCategories,
  describeStatuses,
  FEATURE_CATEGORIES,
  FEATURE_SCOPES,
  FEATURE_STATUSES,
} from '../metadata';
import { buildDependencyGraph, dependencyChainOf, FeatureDependencyError, validateDependencies } from '../resolver';
import { buildSnapshot } from '../snapshot';
import type {
  FeatureCategory,
  FeatureDefinition,
  FeatureMetadata,
  FeatureScope,
  FeatureSnapshot,
} from '../types';

/** Passive catalog the registry is seeded with (allows custom catalogs). */
export const DEFAULT_FEATURE_CATALOG: readonly FeatureDefinition[] = ALL_FEATURES;

export class FeatureRegistry {
  readonly version = FEATURE_REGISTRY_VERSION;
  private readonly all: readonly FeatureDefinition[];
  private readonly byId: ReadonlyMap<string, FeatureDefinition>;
  private readonly graph: ReadonlyMap<string, readonly string[]>;

  constructor(features: readonly FeatureDefinition[] = DEFAULT_FEATURE_CATALOG) {
    const problems = validateDependencies(features);
    if (problems.length > 0) {
      throw new FeatureDependencyError(problems.join(' '));
    }
    this.all = Object.freeze(features);
    this.byId = new Map(features.map((feature) => [feature.id, feature]));
    this.graph = buildDependencyGraph(features);
    // Reject cyclic catalogs up front so no later resolution can enter a loop.
    for (const feature of features) {
      dependencyChainOf(feature.id, this.graph, new Set(), []);
    }
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  /** A feature definition or undefined when absent. */
  get(id: string): FeatureDefinition | undefined {
    return this.byId.get(id);
  }

  /** Whether a feature id exists. */
  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Every feature, in catalog order. */
  list(): readonly FeatureDefinition[] {
    return this.all;
  }

  /** Static metadata for a feature — throws when unknown. */
  describe(id: string): FeatureMetadata {
    const feature = this.byId.get(id);
    if (!feature) {
      throw new FeatureDependencyError(`Unknown feature "${id}".`);
    }
    return {
      id: feature.id,
      name: feature.name,
      description: feature.description,
      category: feature.category,
      scope: feature.scope,
      status: feature.status,
      version: feature.version,
      owner: feature.owner,
      experimental: feature.experimental,
      internal: feature.internal,
      hidden: feature.hidden,
      deprecated: feature.deprecated,
      tags: feature.tags,
    };
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  byCategory(category: FeatureCategory): readonly FeatureDefinition[] {
    return this.all.filter((feature) => feature.category === category);
  }

  byScope(scope: FeatureScope): readonly FeatureDefinition[] {
    return this.all.filter((feature) => feature.scope === scope);
  }

  byStatus(status: FeatureDefinition['status']): readonly FeatureDefinition[] {
    return this.all.filter((feature) => feature.status === status);
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  /** Direct dependency feature definitions for an id (empty when none). */
  dependencies(id: string): readonly FeatureDefinition[] {
    const direct = this.graph.get(id) ?? [];
    const resolved: FeatureDefinition[] = [];
    for (const dependency of direct) {
      const feature = this.byId.get(dependency);
      if (feature) {
        resolved.push(feature);
      }
    }
    return Object.freeze(resolved);
  }

  /** Fully-resolved dependency chain (dependency order, de-duplicated). */
  dependencyChain(id: string): readonly string[] {
    if (!this.byId.has(id)) {
      throw new FeatureDependencyError(`Unknown feature "${id}".`);
    }
    return Object.freeze([...new Set(dependencyChainOf(id, this.graph, new Set(), []))]);
  }

  /** Capability keys granted by a feature (align with CapabilityKey). */
  capabilities(id: string): readonly string[] {
    const feature = this.byId.get(id);
    return feature?.capabilities ?? [];
  }

  /** Permission grants a feature introduces. */
  permissions(id: string): readonly string[] {
    const feature = this.byId.get(id);
    return feature?.permissions ?? [];
  }

  // ── Catalog surface ───────────────────────────────────────────────────────

  categories(): ReturnType<typeof describeCategories> {
    return describeCategories(this.all);
  }

  statuses(): ReturnType<typeof describeStatuses> {
    return describeStatuses(this.all);
  }

  categoryKeys(): readonly FeatureCategory[] {
    return FEATURE_CATEGORIES;
  }

  scopeKeys(): readonly FeatureScope[] {
    return FEATURE_SCOPES;
  }

  statusKeys(): readonly FeatureDefinition['status'][] {
    return FEATURE_STATUSES;
  }

  /** All feature ids. */
  keys(): string[] {
    return this.all.map((feature) => feature.id);
  }

  /** Immutable snapshot of the entire catalog. */
  snapshot(): FeatureSnapshot {
    return buildSnapshot(this.all);
  }

  /** Total feature count. */
  get size(): number {
    return this.all.length;
  }
}

/** Default registry instance booted over the built-in catalog. */
export const featureRegistry: FeatureRegistry = new FeatureRegistry();