import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR', details?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`[NotImplemented] ${feature} is not implemented yet.`);
    this.name = 'NotImplementedError';
  }
}

function friendlyMessage(status: number, data?: Record<string, unknown>): string {
  const raw = data?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  const error = data?.error;
  if (typeof error === 'string' && error.trim()) return error;

  switch (status) {
    case 400:
      return 'The request was invalid. Please check your input and try again.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource could not be found.';
    case 409:
      return 'A record with this name already exists.';
    case 422:
      return 'The request could not be processed. Please check your input.';
    case 429:
      return 'Too many requests. Please try again shortly.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

const SENSITIVE_KEYS = ['password', 'newPassword', 'confirmPassword', 'currentPassword', 'accessToken', 'refreshToken', 'token', 'secret', 'apiKey', 'smtpPassword', 'authorization'];

function redactSensitive(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitive(item));
  }
  if (data && typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      out[key] = SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))
        ? '[REDACTED]'
        : redactSensitive(value);
    }
    return out;
  }
  return data;
}

function buildDebugInfo(error: AxiosError, baseURL: string): string {
  const url = error.config?.url ?? '(none)';
  const method = error.config?.method ?? '(none)';
  const fullURL = baseURL + url;
  const respStatus = error.response?.status ?? '(none)';
  const respData = error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : '(none)';
  return (
    `[AXIOS_DEBUG] url=${fullURL} | method=${method} | errMsg=${error.message} | ` +
    `status=${respStatus} | respData=${respData} | code=${error.code ?? '(none)'} | ` +
    `reqData=${JSON.stringify(redactSensitive(error.config?.data) ?? '(none)')}`
  );
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const baseURL = error.config?.baseURL ?? '(none)';
    const status = error.response?.status ?? 0;
    const code = (data?.code as string) ?? error.code ?? 'UNKNOWN_ERROR';
    const debugInfo = buildDebugInfo(error, baseURL);
    return new ApiError(friendlyMessage(status, data), status, code, debugInfo);
  }
  if (error instanceof Error) {
    return new ApiError(error.message || 'Something went wrong. Please try again.', 0, 'UNKNOWN_ERROR');
  }
  return new ApiError('An unexpected error occurred', 0);
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let sessionGeneration = 0;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Drops the current in-memory access token and invalidates any in-flight
 * token refresh so a stale response can never clobber a newer session.
 */
export function resetClientAuthState(): void {
  sessionGeneration++;
  accessToken = null;
  refreshPromise = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const normalized = normalizeError(error);

    if (normalized.status === 401) {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await refreshAccessToken();
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return api(originalRequest);
        } catch {
          setAccessToken(null);
          void import('@/store/auth-store').then(({ useAuthStore }) => useAuthStore.getState().logout());
          return Promise.reject(normalized);
        }
      }
    }

    return Promise.reject(normalized);
  },
);

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const generation = sessionGeneration;
    try {
      const response = await axios.post<TokenResponse>(
        `${API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const token = response.data.accessToken;
      if (generation !== sessionGeneration) return null;
      setAccessToken(token);
      setAuthCookie(token);
      return token;
    } catch {
      if (generation !== sessionGeneration) return null;
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setAuthCookie(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `access_token=${token}; path=/; max-age=900; samesite=lax`;
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = 'access_token=; path=/; max-age=0';
}
