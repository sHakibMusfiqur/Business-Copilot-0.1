'use client';

import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
  };
}
