import type { TokenCategory, TokenGroup, TokenType } from './types';

/** All supported token categories, in display order. */
export const TOKEN_CATEGORIES: readonly TokenCategory[] = [
  'foundation',
  'semantic',
  'component',
  'motion',
  'layout',
  'accessibility',
  'platform',
];

/** All supported token groups. */
export const TOKEN_GROUPS: readonly TokenGroup[] = [
  'color',
  'surface',
  'elevation',
  'glass',
  'shadow',
  'radius',
  'border',
  'typography',
  'font-scale',
  'line-height',
  'letter-spacing',
  'motion',
  'transition',
  'animation',
  'duration',
  'blur',
  'opacity',
  'z-index',
  'grid',
  'layout',
  'breakpoint',
  'spacing',
  'icon-size',
  'density',
];

/** All supported token types. */
export const TOKEN_TYPES: readonly TokenType[] = [
  'color',
  'number',
  'boolean',
  'size',
  'spacing',
  'radius',
  'shadow',
  'blur',
  'opacity',
  'typography',
  'motion',
  'duration',
  'transition',
  'breakpoint',
  'grid',
  'string',
];

/** Current engine schema version for snapshots. */
export const DESIGN_TOKEN_VERSION = '1.0.0';

/** Category descriptors surfaced via `categories()`. */
export interface TokenCategoryDescriptor {
  key: TokenCategory;
  name: string;
  description?: string;
  tokenCount: number;
}

/** Build category descriptors from a token list. */
export function describeCategories(
  tokens: readonly { category: TokenCategory }[],
): readonly TokenCategoryDescriptor[] {
  return TOKEN_CATEGORIES.map((category) => {
    const count = tokens.filter((token) => token.category === category).length;
    return {
      key: category,
      name: category[0].toUpperCase() + category.slice(1),
      tokenCount: count,
    };
  });
}