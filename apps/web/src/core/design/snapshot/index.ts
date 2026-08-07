import { DESIGN_TOKEN_VERSION } from '../metadata';
import { resolveTokens, type ResolvedToken } from '../resolver';
import type { DesignToken, DesignTokenSnapshot, TokenValue } from '../types';

/** Inputs required to build a snapshot. */
export interface SnapshotInput {
  tokens: readonly DesignToken[];
  byId: ReadonlyMap<string, DesignToken>;
  overrides?: ReadonlyMap<string, TokenValue>;
}

/** Build an immutable snapshot from resolved tokens. */
export function buildSnapshot(input: SnapshotInput): DesignTokenSnapshot {
  const resolved = resolveTokens({
    tokens: input.tokens,
    byId: input.byId,
    overrides: input.overrides,
  });
  return {
    version: DESIGN_TOKEN_VERSION,
    takenAt: new Date().toISOString(),
    entries: resolved.map((entry: ResolvedToken) => ({ ...entry.token, value: entry.value })),
  };
}