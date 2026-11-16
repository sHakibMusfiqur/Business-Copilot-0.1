'use client';

import { AlertCircle, LogIn, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { ApiError, getMe, logout as apiLogout } from '@/lib/api';
import { resetAuthSession } from '@/lib/auth-session';
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

/**
 * Result of the one-shot session restore.
 *
 * `error` is split into `unauthorized` (the API actively refused the session)
 * and everything else (network failure, 5xx, timeout) because the two need
 * different handling: a refusal must NOT auto-redirect, or the middleware —
 * which still trusts the HttpOnly cookies — bounces the user straight back and
 * the shell spins forever.
 */
type RestoreState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string; unauthorized: boolean };

export function AuthProvider({ children, signInPath = '/login' }: AuthProviderProps) {
  const router = useRouter();
  const { user, setUser, setLoading } = useAuthStore();

  const [restore, setRestore] = useState<RestoreState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setupBroadcastListener();
  }, []);

  // Session restore. Always settles: success -> ready, failure -> error, so the
  // spinner can never outlive the request that produced it.
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const me = await getMe();
        if (cancelled) return;
        setUser(me);
        setRestore({ status: 'ready' });
      } catch (err) {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : 0;
        const unauthorized = status === 401 || status === 403;
        // The spinner must stop on every outcome, including failures that do
        // not touch the store (transient errors leave `user` untouched).
        setLoading(false);
        if (unauthorized) {
          // Cookies exist but the API refuses them. Drop the in-memory session
          // and show an explicit state instead of redirecting: redirecting to
          // signInPath would be undone by the middleware, which only inspects
          // the cookies, producing an endless /A -> /B -> /A loop.
          setUser(null);
        }
        setRestore({
          status: 'error',
          unauthorized,
          message:
            err instanceof Error && err.message
              ? err.message
              : 'Could not reach the server. Please try again.',
        });
      }
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, [setUser, setLoading, attempt]);

  useEffect(() => {
    if (user) {
      startRefreshTimer();
    } else {
      stopRefreshTimer();
    }
  }, [user]);

  // Only a *successful* restore without a user may redirect (session ended
  // while the shell was mounted). A failed restore owns the screen instead.
  useEffect(() => {
    if (restore.status !== 'ready') return;
    if (user) return;
    router.replace(signInPath);
  }, [restore.status, user, router, signInPath]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const handleSignInAgain = useCallback(async () => {
    // Best effort: the server clears its cookies when it still accepts the
    // session. It can reject (401) precisely when we are here, so a failure
    // must not strand the user on this panel — fall through to the local
    // cleanup and the sign-in screen regardless.
    try {
      await apiLogout();
    } catch {
      // Session already refused; clear whatever is left client-side below.
    }
    resetAuthSession();
    router.replace(signInPath);
  }, [router, signInPath]);

  // Rendered only when the session could not be established. Never a blank
  // screen and never a spinner without a way out.
  if (restore.status === 'error' && !user) {
    const unauthorized = restore.unauthorized;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold text-foreground">
            {unauthorized ? 'Session expired' : 'Unable to load your session'}
          </h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">{restore.message}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            {unauthorized && (
              <button
                type="button"
                onClick={() => void handleSignInAgain()}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // A restore that is still running, or one that succeeded and is about to
  // redirect, keeps the shell visible so the page is never blank.
  if (!user) {
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
