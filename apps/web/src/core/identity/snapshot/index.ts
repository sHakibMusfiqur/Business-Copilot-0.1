import { IDENTITY_ENGINE_VERSION } from '../metadata';
import type { IdentityEntry, IdentitySnapshot } from '../types';

/** Build an immutable snapshot of the identity registry. */
export function buildSnapshot(
  identities: readonly IdentityEntry[],
): IdentitySnapshot {
  return {
    version: IDENTITY_ENGINE_VERSION,
    takenAt: new Date().toISOString(),
    identities: Object.freeze([...identities]),
  };
}