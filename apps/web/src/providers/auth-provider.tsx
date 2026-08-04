'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { getMe } from '@/lib/api';
import { setupBroadcastListener, startRefreshTimer, stopRefreshTimer } from '@/lib/refresh-manager';
import { useAuthStore } from '@/store/auth-store';

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Where unauthenticated users are sent when the session cannot be restored.
   * Organization shells use the default `/login`; the Platform Console uses
   * `/admin/login` so admins are never bounced to the organization login.
   */
  signInPath?: string;
}

export function AuthProvider({ children, signInPath = '/login' }: AuthProviderProps) {
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
    if (isLoading) return;
    if (!user) {
      router.replace(signInPath);
      return;
    }
    // Dashboard/admin shells must never host a user whose onboarding is
    // incomplete (a registration placeholder org is not a workspace).
    if (user.role !== 'SUPER_ADMIN' && !user.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [isLoading, user, router, signInPath]);

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
