import type { User } from '@bc/types';
import { create } from 'zustand';

import { setAccessToken } from '@/lib/api';

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
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
