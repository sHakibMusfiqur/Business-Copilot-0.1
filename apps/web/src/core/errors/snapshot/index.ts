import { ERROR_ENGINE_VERSION } from '../metadata';
import type { ErrorDefinition, ErrorSnapshot } from '../types';

/** Build an immutable snapshot of the error catalog. */
export function buildSnapshot(
  definitions: readonly ErrorDefinition[],
): ErrorSnapshot {
  return {
    version: ERROR_ENGINE_VERSION,
    takenAt: new Date().toISOString(),
    registry: Object.freeze([...definitions]),
  };
}