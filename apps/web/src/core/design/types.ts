export type TokenValue = string | number | boolean;

/** Strongly typed token kinds supported by the engine. */
export type TokenType =
  | 'color'
  | 'number'
  | 'boolean'
  | 'size'
  | 'spacing'
  | 'radius'
  | 'shadow'
  | 'blur'
  | 'opacity'
  | 'typography'
  | 'motion'
  | 'duration'
  | 'transition'
  | 'breakpoint'
  | 'grid'
  | 'string';

/** High-level category a token belongs to. */
export type TokenCategory =
  | 'foundation'
  | 'semantic'
  | 'component'
  | 'motion'
  | 'layout'
  | 'accessibility'
  | 'platform';

/** Functional grouping within a category. */
export type TokenGroup =
  | 'color'
  | 'surface'
  | 'elevation'
  | 'glass'
  | 'shadow'
  | 'radius'
  | 'border'
  | 'typography'
  | 'font-scale'
  | 'line-height'
  | 'letter-spacing'
  | 'motion'
  | 'transition'
  | 'animation'
  | 'duration'
  | 'blur'
  | 'opacity'
  | 'z-index'
  | 'grid'
  | 'layout'
  | 'breakpoint'
  | 'spacing'
  | 'icon-size'
  | 'density';

/** Immutable metadata attached to every design token. */
export interface TokenMetadata {
  id: string;
  name: string;
  category: TokenCategory;
  group: TokenGroup;
  description?: string;
  type: TokenType;
  version: string;
  readonly?: boolean;
  deprecated?: boolean;
  experimental?: boolean;
  internal?: boolean;
  owner?: string;
  tags?: readonly string[];

  configKey?: string;
}

/** A design token: metadata + concrete value. Immutable by convention. */
export interface DesignToken<T extends TokenValue = TokenValue>
  extends TokenMetadata {
  value: T;
}

/** Immutable snapshot of the entire resolved token set at a point in time. */
export interface DesignTokenSnapshot {
  version: string;
  takenAt: string;
  entries: readonly DesignToken[];
}
