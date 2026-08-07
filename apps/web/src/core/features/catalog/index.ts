import { PLATFORM_FEATURES, PLATFORM_FEATURES_BY_ID } from './platform';
import { BUSINESS_FEATURES, BUSINESS_FEATURES_BY_ID } from './business';
import { INTELLIGENCE_FEATURES, INTELLIGENCE_FEATURES_BY_ID } from './intelligence';
import { EXTENSIBILITY_FEATURES, EXTENSIBILITY_FEATURES_BY_ID } from './extensibility';
import type { FeatureDefinition } from '../types';

export {
  PLATFORM_FEATURES,
  PLATFORM_FEATURES_BY_ID,
  BUSINESS_FEATURES,
  BUSINESS_FEATURES_BY_ID,
  INTELLIGENCE_FEATURES,
  INTELLIGENCE_FEATURES_BY_ID,
  EXTENSIBILITY_FEATURES,
  EXTENSIBILITY_FEATURES_BY_ID,
};

/** The full Business OS feature catalog across every category. */
export const ALL_FEATURES: readonly FeatureDefinition[] = [
  ...PLATFORM_FEATURES,
  ...BUSINESS_FEATURES,
  ...INTELLIGENCE_FEATURES,
  ...EXTENSIBILITY_FEATURES,
];

/** Lookup over the entire catalog by feature id. */
export const ALL_FEATURES_BY_ID: ReadonlyMap<string, FeatureDefinition> = new Map(
  ALL_FEATURES.map((feature) => [feature.id, feature]),
);