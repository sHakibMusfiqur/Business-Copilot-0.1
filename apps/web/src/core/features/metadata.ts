import type { FeatureCategory, FeatureScope, FeatureStatus } from './types';

/** All supported feature categories, in display order. */
export const FEATURE_CATEGORIES: readonly FeatureCategory[] = [
  'platform',
  'business',
  'ai',
  'workflow',
  'automation',
  'reporting',
  'developer',
  'security',
  'administration',
  'integration',
  'plugin',
  'analytics',
  'infrastructure',
];

/** All supported feature lifecycle statuses. */
export const FEATURE_STATUSES: readonly FeatureStatus[] = [
  'experimental',
  'preview',
  'beta',
  'stable',
  'deprecated',
  'internal',
  'hidden',
];

/** All supported feature scopes. */
export const FEATURE_SCOPES: readonly FeatureScope[] = [
  'platform',
  'tenant',
  'organization',
  'workspace',
  'module',
  'user',
];

/** Current feature registry schema version. */
export const FEATURE_REGISTRY_VERSION = '1.0.0';

/** Category descriptor surfaced via `categories()`. */
export interface FeatureCategoryDescriptor {
  key: FeatureCategory;
  name: string;
  featureCount: number;
}

/** Build category descriptors from a feature list. */
export function describeCategories(
  features: readonly { category: FeatureCategory }[],
): readonly FeatureCategoryDescriptor[] {
  return FEATURE_CATEGORIES.map((Category) => {
    const count = features.filter((feature) => feature.category === Category).length;
    return {
      key: Category,
      name: Category[0].toUpperCase() + Category.slice(1),
      featureCount: count,
    };
  });
}

/** Status descriptor surfaced via `statuses()`. */
export interface FeatureStatusDescriptor {
  key: FeatureStatus;
  name: string;
  featureCount: number;
}

/** Build status descriptors from a feature list. */
export function describeStatuses(
  features: readonly { status: FeatureStatus }[],
): readonly FeatureStatusDescriptor[] {
  return FEATURE_STATUSES.map((status) => {
    const count = features.filter((feature) => feature.status === status).length;
    return {
      key: status,
      name: status[0].toUpperCase() + status.slice(1),
      featureCount: count,
    };
  });
}