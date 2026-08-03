'use client';

import { useEffect, type ReactNode } from 'react';

import { useThemeStore } from '@/store/theme-store';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, orgTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    const effective: 'light' | 'dark' | 'system' =
      theme === 'system' ? (orgTheme ?? 'system') : theme;

    if (effective === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      root.classList.toggle('dark', mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    root.classList.toggle('dark', effective === 'dark');
  }, [theme, orgTheme]);

  return <>{children}</>;
}
