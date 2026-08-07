import { CONTAINER_ENGINE_VERSION, type ContainerSnapshot, type ContainerSnapshotEntry } from '../types';
import type { NormalizedProvider } from '../providers';

/** Inputs required to build a snapshot. */
export interface SnapshotInput {
  providers: ReadonlyMap<string, NormalizedProvider>;
  instantiated: ReadonlySet<string>;
}

/** Build an immutable snapshot of the container registry. */
export function buildSnapshot(input: SnapshotInput): ContainerSnapshot {
  const entries: ContainerSnapshotEntry[] = Array.from(input.providers.values()).map(
    (provider) => ({
      token: provider.tokenId,
      provider: provider.provider,
      lifetime: provider.lifetime,
      name: provider.name,
      instantiated: input.instantiated.has(provider.tokenId),
    }),
  );

  return {
    version: CONTAINER_ENGINE_VERSION,
    takenAt: new Date().toISOString(),
    registrySize: entries.length,
    instantiatedCount: entries.filter((entry) => entry.instantiated).length,
    entries,
  };
}