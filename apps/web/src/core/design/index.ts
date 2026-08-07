/** Enterprise Design Token Engine — public surface. */
export { DesignTokenEngine, designTokens, ALL_TOKENS } from './engine';
export { FOUNDATION_TOKENS, FOUNDATION_TOKENS_BY_ID } from './foundation';
export { SEMANTIC_TOKENS, SEMANTIC_TOKENS_BY_ID } from './semantic';
export { MOTION_TOKENS, MOTION_TOKENS_BY_ID } from './motion';
export { LAYOUT_TOKENS, LAYOUT_TOKENS_BY_ID } from './layout';
export { resolveTokens, resolveOne, indexTokens, referencedIds, TokenReferenceError } from './resolver';
export { buildSnapshot } from './snapshot';
export { TOKEN_CATEGORIES, TOKEN_GROUPS, TOKEN_TYPES, DESIGN_TOKEN_VERSION, describeCategories } from './metadata';
export type { TokenCategoryDescriptor } from './metadata';
export type {
  TokenValue,
  TokenType,
  TokenCategory,
  TokenGroup,
  TokenMetadata,
  DesignToken,
  DesignTokenSnapshot,
} from './types';