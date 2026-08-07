import { FOUNDATION_TOKENS } from './foundation';
import { SEMANTIC_TOKENS } from './semantic';
import { MOTION_TOKENS } from './motion';
import { LAYOUT_TOKENS } from './layout';
import { DESIGN_TOKEN_VERSION, describeCategories, TOKEN_CATEGORIES } from './metadata';
import { indexTokens, resolveOne, resolveTokens, TokenReferenceError } from './resolver';
import { buildSnapshot } from './snapshot';
import type {
  DesignToken,
  DesignTokenSnapshot,
  TokenCategory,
  TokenGroup,
  TokenMetadata,
  TokenValue,
} from './types';

/** All tokens across every category, in a stable order. */
export const ALL_TOKENS: readonly DesignToken[] = [
  ...FOUNDATION_TOKENS,
  ...SEMANTIC_TOKENS,
  ...MOTION_TOKENS,
  ...LAYOUT_TOKENS,
];

export class DesignTokenEngine {
  readonly version = DESIGN_TOKEN_VERSION;
  private readonly all: readonly DesignToken[];
  private readonly byId: ReadonlyMap<string, DesignToken>;
  private overrides = new Map<string, TokenValue>();

  constructor(tokens: readonly DesignToken[] = ALL_TOKENS) {
    this.all = tokens;
    this.byId = indexTokens(tokens);
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  /** Resolve a token to its concrete value — throws when unknown. */
  get(id: string): TokenValue {
    return resolveOne(id, { tokens: this.all, byId: this.byId, overrides: this.overrides }).value;
  }

  /** Whether a token id exists. */
  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Full resolved token (metadata + final value) for an id. */
  resolve(id: string): DesignToken {
    const resolved = resolveOne(id, { tokens: this.all, byId: this.byId, overrides: this.overrides });
    return { ...resolved.token, value: resolved.value };
  }

  /** Static metadata for a token id — throws when unknown. */
  describe(id: string): TokenMetadata {
    const token = this.byId.get(id);
    if (!token) {
      throw new TokenReferenceError(`Unknown design token "${id}".`);
    }
    return {
      id: token.id,
      name: token.name,
      category: token.category,
      group: token.group,
      description: token.description,
      type: token.type,
      version: token.version,
      readonly: token.readonly,
      deprecated: token.deprecated,
      experimental: token.experimental,
      internal: token.internal,
      owner: token.owner,
      tags: token.tags,
      configKey: token.configKey,
    };
  }

  /** All tokens within a functional group (e.g. 'color', 'spacing'). */
  group(group: TokenGroup): readonly DesignToken[] {
    return this.all.filter((token) => token.group === group);
  }

  /** All token ids. */
  keys(): string[] {
    return this.all.map((token) => token.id);
  }

  /** All token categories with counts. */
  categories(): ReturnType<typeof describeCategories> {
    return describeCategories(this.all);
  }

  // ── Category accessors ────────────────────────────────────────────────────

  foundation(): readonly DesignToken[] {
    return this.all.filter((token) => token.category === 'foundation');
  }

  semantic(): readonly DesignToken[] {
    return this.all.filter((token) => token.category === 'semantic');
  }

  motion(): readonly DesignToken[] {
    return this.all.filter((token) => token.category === 'motion');
  }

  layout(): readonly DesignToken[] {
    return this.all.filter((token) => token.category === 'layout');
  }

  component(): readonly DesignToken[] {
    return this.all.filter((token) => token.category === 'component');
  }

  byCategory(category: TokenCategory): readonly DesignToken[] {
    return this.all.filter((token) => token.category === category);
  }

  // ── Overrides ─────────────────────────────────────────────────────────────

  /** Apply a per-token override (e.g. from config or an active theme). */
  setOverride(id: string, value: TokenValue): void {
    if (!this.byId.has(id)) {
      throw new TokenReferenceError(`Unknown design token "${id}".`);
    }
    this.overrides.set(id, value);
  }

  clearOverride(id: string): void {
    this.overrides.delete(id);
  }

  clearOverrides(): void {
    this.overrides = new Map();
  }

  syncFromConfig<T>(
    read: (key: string) => T | undefined,
  ): void {
    for (const token of this.all) {
      if (token.configKey) {
        const value = read(token.configKey);
        if (value !== undefined) {
          this.overrides.set(token.id, value as TokenValue);
        }
      }
    }
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────

  /** Immutable snapshot of every resolved token at this instant. */
  snapshot(): DesignTokenSnapshot {
    return buildSnapshot({
      tokens: this.all,
      byId: this.byId,
      overrides: this.overrides,
    });
  }

  /** List of every supported category key. */
  categoryKeys(): readonly TokenCategory[] {
    return TOKEN_CATEGORIES;
  }

  /** Total token count. */
  get size(): number {
    return this.all.length;
  }

  /** Flatten the engine to a plain resolved-token array (tree-shakable). */
  toArray(): readonly DesignToken[] {
    return resolveTokens({ tokens: this.all, byId: this.byId, overrides: this.overrides }).map(
      (entry) => ({ ...entry.token, value: entry.value }),
    );
  }
}

/** Default engine singleton booted over the built-in catalog. */
export const designTokens: DesignTokenEngine = new DesignTokenEngine();