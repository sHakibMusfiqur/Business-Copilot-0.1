import { ApiError } from '@/lib/api/client';

export interface RegistrationDeps {
  name: string;
  email: string;
  password: string;
  registerUser: (name: string, email: string, password: string) => Promise<{ email: string; message: string }>;
  createSession: (email: string, name: string) => Promise<{ id: string; onboardingToken?: string }>;
  navigate: (url: string) => void;
  setError: (message: string | null) => void;
  pingHealth?: () => Promise<unknown>;
  onStatus?: (message: string) => void;
}

export const STARTING_STATUS_MESSAGE = 'Starting your account setup…';
export const CONNECTING_STATUS_MESSAGE = 'Connecting to the server…';
export const CONNECTION_ERROR_MESSAGE = 'Unable to connect to the server. Please try again.';

export const HEALTH_POLL_INTERVAL_MS = 1000;
export const HEALTH_POLL_MAX_ATTEMPTS = 120;
export const REGISTER_RETRY_DELAY_MS = 1000;

let inFlight: Promise<void> | null = null;

function isConnectionFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls the public health endpoint until it answers, which proves the API
 * process is listening (in dev the web app boots well before the API cold-start
 * finishes). Only network-level (status 0) failures keep polling; any HTTP
 * response — even 4xx/5xx — means the API is up and the caller should proceed.
 * Gives up after ~2 minutes.
 */
export async function waitForApiReadiness(pingHealth: () => Promise<unknown>): Promise<boolean> {
  for (let attempt = 0; attempt < HEALTH_POLL_MAX_ATTEMPTS; attempt++) {
    try {
      await pingHealth();
      return true;
    } catch (error) {
      if (!isConnectionFailure(error)) return true;
      if (attempt < HEALTH_POLL_MAX_ATTEMPTS - 1) await delay(HEALTH_POLL_INTERVAL_MS);
    }
  }
  return false;
}

/**
 * Registers a new account with a bounded cold-start retry. The first attempt is
 * made immediately; only a connection-level failure (status 0 — the request never
 * reached the server) is retried, after the API becomes reachable via the public
 * health endpoint (or a short delay when no probe is available). HTTP/application
 * errors (400, 409, 429, 500, ...) are never retried.
 */
export async function submitRegistration(p: RegistrationDeps): Promise<void> {
  // Guard against duplicate submissions while one is still running (e.g. a fast
  // double-click before React re-renders the disabled button).
  if (inFlight) return;
  inFlight = runRegistration(p);
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

async function runRegistration(p: RegistrationDeps): Promise<void> {
  let accountCreated = false;
  try {
    p.onStatus?.(STARTING_STATUS_MESSAGE);

    try {
      await p.registerUser(p.name, p.email, p.password);
    } catch (firstError) {
      if (!isConnectionFailure(firstError)) throw firstError;
      p.onStatus?.(CONNECTING_STATUS_MESSAGE);
      // A connection-level failure means the request never reached the server
      // (e.g. the API is still cold-starting in dev), so no pending registration
      // exists. Wait for the API to become reachable, then retry exactly once.
      if (p.pingHealth) {
        const ready = await waitForApiReadiness(p.pingHealth);
        if (!ready) {
          p.setError(CONNECTION_ERROR_MESSAGE);
          return;
        }
      } else {
        await delay(REGISTER_RETRY_DELAY_MS);
      }
      await p.registerUser(p.name, p.email, p.password);
    }
    accountCreated = true;

    // Reserve an onboarding session so the user can complete the wizard. The
    // session is anonymous (no bound user) until email verification binds it.
    // Registration never issues tokens, so the user stays unauthenticated here.
    try {
      const session = await p.createSession(p.email, p.name);
      p.navigate(`/onboarding/verify?session=${session.id}`);
      return;
    } catch {
      // The account is already committed; resume rather than dead-end.
      p.setError('Your account was created. Please sign in to continue onboarding.');
      return;
    }
  } catch (err) {
    if (accountCreated) {
      p.setError('Your account was created. Please sign in to continue onboarding.');
      return;
    }
    if (isConnectionFailure(err)) {
      p.setError(CONNECTION_ERROR_MESSAGE);
      return;
    }
    p.setError(err instanceof Error ? err.message : 'Registration failed');
  }
}
