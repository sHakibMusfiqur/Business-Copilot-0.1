

import { group } from 'k6';
import { config } from '../config.js';
import { publicPost, apiGet, parseJson } from './http.js';


// ─── JWT Helpers ─────────────────────────────────────────────────────────────

// Base64 alphabet (standard, used after converting base64url → base64)
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode a base64 string to a plain string.
 * Hand-rolled to avoid k6/encoding inconsistencies across versions.
 */
function base64Decode(input) {
  // Strip padding
  let str = input.replace(/=+$/, '');
  // Replace base64url chars → standard base64
  str = str.replace(/-/g, '+').replace(/_/g, '/');

  let result = '';
  for (let i = 0; i < str.length; i += 4) {
    const b1 = B64_CHARS.indexOf(str[i]);
    const b2 = B64_CHARS.indexOf(str[i + 1]);
    const b3 = B64_CHARS.indexOf(str[i + 2]);
    const b4 = B64_CHARS.indexOf(str[i + 3]);

    const triplet = (b1 << 18) | (b2 << 12) | ((b3 !== -1 ? b3 : 0) << 6) | (b4 !== -1 ? b4 : 0);

    result += String.fromCharCode((triplet >> 16) & 0xff);
    if (str[i + 2] !== undefined && B64_CHARS.indexOf(str[i + 2]) !== -1) {
      result += String.fromCharCode((triplet >> 8) & 0xff);
    }
    if (str[i + 3] !== undefined && B64_CHARS.indexOf(str[i + 3]) !== -1) {
      result += String.fromCharCode(triplet & 0xff);
    }
  }
  return result;
}

/**
 * Decode a JWT payload without verification (k6 only needs the exp claim).
 * Returns the decoded payload object or null on failure.
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = base64Decode(parts[1]);
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

/**
 * Get the JWT exp claim as epoch milliseconds, or null if unavailable.
 */
export function getTokenExpiry(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000; // convert seconds → ms
}

/**
 * Returns true if the token expires within `withinMs` milliseconds from now.
 */
export function tokenNeedsRefresh(token, withinMs = 60_000) {
  const expMs = getTokenExpiry(token);
  if (expMs === null) return true; // cannot decode → treat as needing refresh
  return Date.now() >= expMs - withinMs;
}


// ─── Auth API Calls ──────────────────────────────────────────────────────────

export function login(email, password) {
  const res = publicPost('/auth/login', { email, password });
  if (res.status !== 200) return null;
  const body = parseJson(res);
  if (!body) return null;
  return {
    accessToken: body.accessToken || body.access_token,
    refreshToken: body.refreshToken || body.refresh_token,
  };
}


export function refreshTokenApi(refreshToken) {
  const res = publicPost('/auth/refresh', { refreshToken });
  if (res.status !== 200) return null;
  const body = parseJson(res);
  if (!body) return null;
  return {
    accessToken: body.accessToken || body.access_token,
    refreshToken: body.refreshToken || body.refresh_token,
  };
}

/**
 * Get current user profile (/auth/me).
 */
export function getMe(token) {
  const res = apiGet('/auth/me', token);
  if (res.status !== 200) return null;
  return parseJson(res);
}


export function authenticateTestUser() {
  const tokens = login(config.testUserEmail, config.testUserPassword);
  if (!tokens || !tokens.accessToken) return null;
  const user = getMe(tokens.accessToken);
  return { token: tokens.accessToken, user };
}


// ─── Per-VU Token State Management ───────────────────────────────────────────

/**
 * Module-level per-VU token state.
 * Each VU gets its own { token, refreshToken, expiresAt } entry keyed by __VU.
 * This prevents cross-VU token sharing and refresh-token rotation conflicts.
 */
const vuState = {};

/**
 * Initialize or return the token state for the current VU.
 * On the first call for a given VU, copies from the shared setup data.
 * Subsequent calls return the VU's own state (which may have been refreshed).
 *
 * @param {object} setupData - The object returned by setup() (shared across VUs).
 * @returns {{ token: string, refreshToken: string, expiresAt: number }}
 */
export function getVuTokenState(setupData) {
  const vuId = __VU;
  if (!vuState[vuId]) {
    const expMs = getTokenExpiry(setupData.token);
    vuState[vuId] = {
      token: setupData.token,
      refreshToken: setupData.refreshToken,
      expiresAt: expMs || 0,
    };
  }
  return vuState[vuId];
}

/**
 * Attempt to refresh the current VU's access token.
 *
 * Strategy:
 *   1. Check state.expiresAt (from the JWT exp claim at init/refresh time).
 *   2. If token expires within refreshWindowMs → try POST /auth/refresh.
 *   3. If refresh succeeds → update VU state with new tokens.
 *   4. If refresh fails (401/429/etc.) → re-login to get a fresh pair.
 *   5. If re-login also fails → throw (fail clearly, never silently continue).
 *
 * A random jitter (0–60 s) is subtracted from the refresh window to avoid
 * a synchronized stampede when all VUs' tokens expire at the same time.
 *
 * @param {object} setupData - Shared setup data (used only for re-login fallback).
 * @returns {string} The current valid access token.
 */
export function ensureFreshToken(setupData) {
  const state = getVuTokenState(setupData);

  // Add per-VU jitter so not all VUs refresh at the same instant.
  // Jitter is seeded once per VU (using __VU as a simple deterministic seed).
  if (!state.jitterApplied) {
    state.jitterMs = ((__VU * 7919) % 60) * 1000; // 0–59 s deterministic per VU
    state.jitterApplied = true;
  }

  const refreshWindowMs = 60_000 + state.jitterMs; // 60–119 s before expiry

  // Use state.expiresAt (set at init / last refresh) rather than re-decoding the JWT.
  // This allows the value to be overridden for testing and avoids redundant decoding.
  const now = Date.now();
  if (state.expiresAt > 0 && now < state.expiresAt - refreshWindowMs) {
    return state.token; // still valid, no action needed
  }

  // ── Attempt refresh ──────────────────────────────────────────────────────
  const refreshed = refreshTokenApi(state.refreshToken);
  if (refreshed && refreshed.accessToken) {
    state.token = refreshed.accessToken;
    state.refreshToken = refreshed.refreshToken || state.refreshToken;
    state.expiresAt = getTokenExpiry(refreshed.accessToken) || 0;
    return state.token;
  }

  // ── Refresh failed → re-login ────────────────────────────────────────────
  const loggedIn = login(config.testUserEmail, config.testUserPassword);
  if (!loggedIn || !loggedIn.accessToken) {
    throw new Error(
      `VU ${__VU}: Token refresh failed and re-login also failed. ` +
      `Cannot continue without a valid access token.`
    );
  }

  state.token = loggedIn.accessToken;
  state.refreshToken = loggedIn.refreshToken;
  state.expiresAt = getTokenExpiry(loggedIn.accessToken) || 0;
  return state.token;
}

/**
 * Create a setup function for k6 scenarios.
 *
 * Returns tokens that will be shared across VUs. Each VU then manages its
 * own token lifecycle via ensureFreshToken() during iterations.
 */
export function createSetupFunction(email, password) {
  return function setup() {
    const userEmail = email || config.testUserEmail;
    const userPassword = password || config.testUserPassword;

    if (!userEmail || !userPassword) {
      throw new Error(
        'Missing required test credentials. ' +
        'Set K6_TEST_USERS and K6_TEST_PASSWORD environment variables before running load tests.'
      );
    }

    const tokens = login(userEmail, userPassword);
    if (!tokens || !tokens.accessToken) {
      throw new Error(`Failed to authenticate: ${userEmail}`);
    }
    return { token: tokens.accessToken, refreshToken: tokens.refreshToken };
  };
}
