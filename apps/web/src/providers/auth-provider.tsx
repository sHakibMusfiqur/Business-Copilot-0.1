'use client';

import { useEffect, type ReactNode } from 'react';

import { getProfile } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setLoading, isLoading } = useAuthStore();

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getProfile();
        setUser(user);
      } catch {
        setUser(null);
      }
    }
    void loadUser();
  }, [setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
