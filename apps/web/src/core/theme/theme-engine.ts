import { DEFAULT_THEME_ID, THEMES, THEME_BY_ID } from './tokens';
import type { DensityToken, RadiusToken, SpacingToken, ThemeDefinition, ThemeTokens } from './types';

export interface ThemeEngine {
  all: ThemeDefinition[];
  byId: (id: string) => ThemeDefinition | undefined;
  resolve: (id?: string) => ThemeDefinition;
  tokens: (id?: string) => ThemeTokens;
  spacing: (token: SpacingToken) => string;
  radius: (token: RadiusToken) => string;
  density: (id?: string) => DensityToken;
}

export function createThemeEngine(): ThemeEngine {
  return {
    all: THEMES,
    byId: (id) => (id ? THEME_BY_ID[id] : undefined),
    resolve: (id) => (id ? THEME_BY_ID[id] ?? THEMES[0] : THEMES[0]),
    tokens: (id) => (id ? (THEME_BY_ID[id] ?? THEMES[0]).tokens : THEMES[0].tokens),
    spacing: (token) => THEMES[0].tokens.spacing[token],
    radius: (token) => THEMES[0].tokens.radius[token],
    density: (id) => (id ? (THEME_BY_ID[id] ?? THEMES[0]).density : THEMES[0].density),
  };
}

export const themeEngine: ThemeEngine = createThemeEngine();

export { DEFAULT_THEME_ID };
