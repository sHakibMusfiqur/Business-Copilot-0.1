export type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export type RadiusToken = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type FontScaleToken = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export type DensityToken = 'comfortable' | 'compact';

export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

export interface RadiusTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface FontScaleTokens {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface ThemeTokens {
  spacing: SpacingTokens;
  radius: RadiusTokens;
  font: FontScaleTokens;
  /** CSS variable references for colors (light/dark resolved by the app theme). */
  color: Record<string, string>;
  surface: Record<string, string>;
  shadow: Record<string, string>;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  tokens: ThemeTokens;
  density: DensityToken;
}
