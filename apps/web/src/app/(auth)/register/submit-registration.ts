import { ApiError } from '@/lib/api/client';

export interface RegistrationDeps {
  name: string;
  email: string;
  password: string;
  registerUser: (name: string, email: string, password: string) => Promise<{ email: string; message: string }>;
  createSession: (email: string, name: string) => Promise<{ id: string; onboardingToken?: string }>;
  navigate: (url: string) => void;
  setError: (message: string | null) => void;
}

const RETRY_DELAY_MS = 500;

function isConnectionFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitRegistration(p: RegistrationDeps): Promise<void> {
  let accountCreated = false;
  try {
    try {
      await p.registerUser(p.name, p.email, p.password);
    } catch (firstError) {
      if (!isConnectionFailure(firstError)) throw firstError;
      // A connection-level failure means the request never reached the server
      // (e.g. the API is still cold-starting in dev), so no pending registration
      // exists. Retry exactly once after a short delay; HTTP/application errors
      // (400, 409, 429, 500, ...) are never retried.
      await delay(RETRY_DELAY_MS);
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
    p.setError(err instanceof Error ? err.message : 'Registration failed');
  }
}
