'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { getMe } from '@/lib/api';
import { setupBroadcastListener, startRefreshTimer, stopRefreshTimer } from '@/lib/refresh-manager';
import { useAuthStore } from '@/store/auth-store';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const { user, setUser, setLoading, isLoading } = useAuthStore();

  useEffect(() => {
    setupBroadcastListener();
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getMe();
        setUser(user);
      } catch {
        setUser(null);
      }
    }
    void loadUser();
  }, [setUser, setLoading]);

  useEffect(() => {
    if (user) {
      startRefreshTimer();
    } else if (!isLoading) {
      stopRefreshTimer();
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

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

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
