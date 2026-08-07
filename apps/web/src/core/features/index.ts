/** Enterprise Feature Registry — public surface. */
export { FeatureRegistry, featureRegistry, DEFAULT_FEATURE_CATALOG } from './registry';
export {
  ALL_FEATURES,
  ALL_FEATURES_BY_ID,
  PLATFORM_FEATURES,
  BUSINESS_FEATURES,
  INTELLIGENCE_FEATURES,
  EXTENSIBILITY_FEATURES,
} from './catalog';
export { resolveFeatures, dependencyChainOf, buildDependencyGraph, validateDependencies, FeatureDependencyError } from './resolver';
export { buildSnapshot } from './snapshot';
export { FEATURE_CATEGORIES, FEATURE_STATUSES, FEATURE_SCOPES, FEATURE_REGISTRY_VERSION, describeCategories, describeStatuses } from './metadata';
export type { FeatureCategoryDescriptor, FeatureStatusDescriptor } from './metadata';
export type {
  FeatureCategory,
  FeatureStatus,
  FeatureScope,
  FeatureMetadata,
  FeatureDefinition,
  ResolvedFeature,
  FeatureSnapshot,
} from './types';