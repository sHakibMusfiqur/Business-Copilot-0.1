import type { DesignToken, TokenValue } from '../types';

/** Reference syntax used in token values: `{token.id}`. */
const REFERENCE_PATTERN = /\{([^{}]+)\}/g;

/** Error thrown when a token reference cannot be resolved. */
export class TokenReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenReferenceError';
  }
}

export interface TokenResolverInput {
  tokens: readonly DesignToken[];
  byId: ReadonlyMap<string, DesignToken>;
  /** Per-token override values keyed by token id (highest priority). */
  overrides?: ReadonlyMap<string, TokenValue>;
}

/** A fully resolved token with every reference replaced by a concrete value. */
export interface ResolvedToken {
  token: DesignToken;
  value: TokenValue;
}

/** Build a lookup map from a token list. */
export function indexTokens(tokens: readonly DesignToken[]): ReadonlyMap<string, DesignToken> {
  return new Map(tokens.map((token) => [token.id, token]));
}

/** Collect every token id referenced by a token's value (may be none). */
export function referencedIds(value: string): string[] {
  const ids: string[] = [];
  for (const match of value.matchAll(REFERENCE_PATTERN)) {
    ids.push(match[1]);
  }
  return ids;
}

/** Resolve one token, following references with cycle detection. */
function resolveTokenValue(
  token: DesignToken,
  byId: ReadonlyMap<string, DesignToken>,
  overrides: ReadonlyMap<string, TokenValue>,
  stack: string[],
): TokenValue {
  const override = overrides.get(token.id);
  if (override !== undefined) {
    return override;
  }

  if (typeof token.value !== 'string') {
    return token.value;
  }

  if (!REFERENCE_PATTERN.test(token.value)) {
    return token.value;
  }

  return token.value.replace(REFERENCE_PATTERN, (match, refId: string) => {
    if (stack.includes(refId)) {
      throw new TokenReferenceError(
        `Cyclic token reference: ${[...stack, refId].join(' -> ')}`,
      );
    }
    const referenced = byId.get(refId);
    if (!referenced) {
      throw new TokenReferenceError(
        `Unresolved token reference "${refId}" in "${token.id}".`,
      );
    }
    const resolved = resolveTokenValue(referenced, byId, overrides, [...stack, refId]);
    if (typeof resolved === 'string' && /^\d+$/.test(resolved)) {
      return resolved;
    }
    return String(resolved);
  });
}


export function resolveTokens(input: TokenResolverInput): ResolvedToken[] {
  return input.tokens.map((token) => ({
    token,
    value: resolveTokenValue(token, input.byId, input.overrides ?? new Map(), []),
  }));
}

/** Resolve a single token by id. Throws when unknown. */
export function resolveOne(
  id: string,
  input: TokenResolverInput,
): ResolvedToken {
  const token = input.byId.get(id);
  if (!token) {
    throw new TokenReferenceError(`Unknown design token "${id}".`);
  }
  return {
    token,
    value: resolveTokenValue(token, input.byId, input.overrides ?? new Map(), []),
  };
}