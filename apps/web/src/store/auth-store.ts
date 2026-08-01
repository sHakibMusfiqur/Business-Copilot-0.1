import type { User } from '@bc/types';
import { create } from 'zustand';

import { setAccessToken, clearAuthCookie } from '@/lib/api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null, accessToken?: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user, accessToken) => {
    if (accessToken) {
      setAccessToken(accessToken);
    }
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    setAccessToken(null);
    clearAuthCookie();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
