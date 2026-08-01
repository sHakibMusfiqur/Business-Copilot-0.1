import { clearAuthCookie, resetClientAuthState } from '@/lib/api/client';
import { queryClient } from '@/lib/query-client';
import { stopRefreshTimer } from '@/lib/refresh-manager';
import { useAuthStore } from '@/store/auth-store';

/**
 * Fully clears the current client-side auth/session state so a new account can
 * start from a clean slate: in-memory access token, auth cookie, refresh
 * timers, React Query cache, and the auth store. Must run synchronously BEFORE
 * the new user is set via `setUser`.
 */
export function resetAuthSession(): void {
  resetClientAuthState();
  clearAuthCookie();
  stopRefreshTimer();
  queryClient.clear();
  useAuthStore.getState().logout();
}
