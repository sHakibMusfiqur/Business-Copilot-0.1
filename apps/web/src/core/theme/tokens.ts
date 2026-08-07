import type { ThemeDefinition, ThemeTokens } from './types';

/** Tokens mirror the Tailwind/CSS scale already in use; no visual change. */
const BASE_TOKENS: ThemeTokens = {
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  font: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  color: {
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    card: 'hsl(var(--card))',
    primary: 'hsl(var(--primary))',
    primaryForeground: 'hsl(var(--primary-foreground))',
    muted: 'hsl(var(--muted))',
    mutedForeground: 'hsl(var(--muted-foreground))',
    accent: 'hsl(var(--accent))',
    border: 'hsl(var(--border))',
    destructive: 'hsl(var(--destructive))',
  },
  surface: {
    sidebar: 'hsl(var(--sidebar-background))',
    sidebarForeground: 'hsl(var(--sidebar-foreground))',
    sidebarMuted: 'hsl(var(--sidebar-muted))',
    sidebarAccent: 'hsl(var(--sidebar-accent))',
    sidebarBorder: 'hsl(var(--sidebar-border))',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    card: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
  },
};

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    label: 'Default',
    tokens: BASE_TOKENS,
    density: 'comfortable',
  },
];

export const THEME_BY_ID: Record<string, ThemeDefinition> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
);

export const DEFAULT_THEME_ID = THEMES[0].id;
