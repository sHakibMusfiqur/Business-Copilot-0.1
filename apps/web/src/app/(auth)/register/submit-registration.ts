export interface RegistrationDeps {
  name: string;
  email: string;
  password: string;
  registerUser: (name: string, email: string, password: string) => Promise<{ user: { id: string; email: string; name: string }; message: string }>;
  createSession: (email: string, name: string) => Promise<{ id: string; onboardingToken?: string }>;
  navigate: (url: string) => void;
  setError: (message: string | null) => void;
}

export async function submitRegistration(p: RegistrationDeps): Promise<void> {
  let accountCreated = false;
  try {
    await p.registerUser(p.name, p.email, p.password);
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