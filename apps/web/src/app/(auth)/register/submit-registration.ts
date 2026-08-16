import type { User } from '@bc/types';

import type { OnboardingSession } from '@/lib/api/onboarding';


export interface RegistrationDeps {
  name: string;
  email: string;
  password: string;
  registerUser: (name: string, email: string, password: string) => Promise<{ user: User; accessToken: string }>;
  createSession: (email: string, name: string) => Promise<OnboardingSession>;
  updateSession: (id: string, data: Record<string, unknown>) => Promise<OnboardingSession>;
  getSessionByEmail: (email: string) => Promise<OnboardingSession>;
  setUser: (user: User | null, accessToken?: string | null) => void;
  navigate: (url: string) => void;
  setError: (message: string | null) => void;
}


export async function submitRegistration(p: RegistrationDeps): Promise<void> {
  let accountCreated = false;
  try {
    const result = await p.registerUser(p.name, p.email, p.password);
    accountCreated = true;
    p.setUser(result.user, result.accessToken);

    let session: OnboardingSession | null = null;
    try {
      session = await p.createSession(p.email, p.name);
      await p.updateSession(session.id, { userId: result.user.id });
    } catch {
      // The account is already committed; resume rather than dead-end.
      if (session) {
        p.navigate(`/onboarding/verify?session=${session.id}`);
        return;
      }
      if (await recoverByEmail(p)) return;
      p.setError('Your account was created. Please sign in to continue onboarding.');
      return;
    }
    p.navigate(`/onboarding/verify?session=${session.id}`);
  } catch (err) {
    if (accountCreated) {
      if (await recoverByEmail(p)) return;
      p.setError('Your account was created. Please sign in to continue onboarding.');
      return;
    }
    p.setError(err instanceof Error ? err.message : 'Registration failed');
  }
}

async function recoverByEmail(p: RegistrationDeps): Promise<boolean> {
  try {
    const resumed = await p.getSessionByEmail(p.email);
    p.navigate(`/onboarding/verify?session=${resumed.id}`);
    return true;
  } catch {
    return false;
  }
}