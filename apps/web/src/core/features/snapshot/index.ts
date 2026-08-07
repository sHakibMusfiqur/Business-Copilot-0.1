import { FEATURE_REGISTRY_VERSION } from '../metadata';
import { resolveFeatures } from '../resolver';
import type { FeatureDefinition, FeatureSnapshot } from '../types';

/** Build an immutable snapshot over the given feature catalog. */
export function buildSnapshot(features: readonly FeatureDefinition[]): FeatureSnapshot {
  return {
    version: FEATURE_REGISTRY_VERSION,
    takenAt: new Date().toISOString(),
    features: resolveFeatures(features),
  };
}