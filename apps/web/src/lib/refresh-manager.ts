import { getAccessToken, refreshAccessToken } from '@/lib/api';
import { decodeJWT } from '@/lib/jwt';
import { useAuthStore } from '@/store/auth-store';

const REFRESH_MARGIN_MS = 60 * 1000;
const JITTER_MAX_MS = 30_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 30_000;

let broadcastChannel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel('token_refresh');
    } catch {
      return null;
    }
  }
  return broadcastChannel;
}

function broadcast(): void {
  const ch = getChannel();
  if (ch) {
    try { ch.postMessage('refreshed'); } catch { /* ignore */ }
  }
}

export function setupBroadcastListener(): void {
  const ch = getChannel();
  if (!ch) return;
  ch.onmessage = (event) => {
    if (event.data === 'refreshed') {
      stopRefreshTimer();
      startRefreshTimer();
    }
  };
}

export function startRefreshTimer(): void {
  stopRefreshTimer();
  retryCount = 0;

  const token = getAccessToken();
  if (!token) return;

  const payload = decodeJWT(token);
  if (!payload?.exp) return;

  const expiresAt = payload.exp * 1000;
  const now = Date.now();
  const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
  const delay = Math.max(0, expiresAt - now - REFRESH_MARGIN_MS - jitter);

  if (delay <= 0) {
    void refreshNow();
    return;
  }

  refreshTimer = setTimeout(() => {
    void refreshNow();
  }, delay);
}

export function stopRefreshTimer(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

async function refreshNow(): Promise<void> {
  try {
    const newToken = await refreshAccessToken();
    if (newToken) {
      retryCount = 0;
      broadcast();
      startRefreshTimer();
    } else if (retryCount < MAX_RETRIES) {
      retryCount++;
      retryTimer = setTimeout(() => { void refreshNow(); }, RETRY_DELAY_MS);
    } else {
      retryCount = 0;
      useAuthStore.getState().logout();
    }
  } catch {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      retryTimer = setTimeout(() => { void refreshNow(); }, RETRY_DELAY_MS);
    } else {
      retryCount = 0;
      useAuthStore.getState().logout();
    }
  }
}
