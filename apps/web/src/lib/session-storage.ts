const KEY = 'bc_onboarding';

export interface StoredSession {
  id: string;
  organizationId: string | null;
}

export function setOnboardingSession(data: StoredSession): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* noop */ }
}

export function getOnboardingSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
