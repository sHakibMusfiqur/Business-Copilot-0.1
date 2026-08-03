import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
type OrgTheme = 'light' | 'dark' | null;

interface ThemeState {
  theme: Theme;
  orgTheme: OrgTheme;
  setTheme: (theme: Theme) => void;
  setOrgTheme: (orgTheme: OrgTheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  orgTheme: null,
  setTheme: (theme) => set({ theme }),
  setOrgTheme: (orgTheme) => set({ orgTheme }),
}));
