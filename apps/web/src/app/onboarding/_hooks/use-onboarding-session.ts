'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getSession, getSessionByEmail, createSession, updateSession,
  completeStep as apiCompleteStep,
  type OnboardingSession,
} from '@/lib/onboarding-api';

const SAVE_DEBOUNCE_MS = 2000;

const PERSIST_FIELDS: (keyof OnboardingSession)[] = [
  'currentStep', 'selectedIndustry', 'selectedCategory', 'selectedCategories',
  'orgName', 'orgEmail', 'orgPhone', 'orgWebsite', 'orgCountry', 'orgState',
  'orgCity', 'orgAddress', 'orgTimezone', 'orgCurrency', 'orgLanguage',
  'businessProfile', 'selectedModules', 'aiEnabled', 'aiLanguage',
  'aiPersonality', 'selectedPlanId',
];

function pickPersistFields(s: OnboardingSession): Record<string, unknown> {
  const data: Record<string, unknown> = { version: s.version };
  for (const f of PERSIST_FIELDS) data[f] = s[f];
  return data;
}

export function useOnboardingSession() {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId && !session) {
      getSession(sessionId).then(setSession).catch(() => {});
    }
  }, [searchParams]);

  const loadSession = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = await getSession(id);
      setSession(s);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLatestByEmail = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = await getSessionByEmail(email);
      setSession(s);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const initSession = useCallback(async (email: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = await createSession(email, name);
      sessionRef.current = s;
      setSession(s);
      router.replace(`/onboarding?session=${s.id}`);
      return s;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /* TRACE POINT 1 — after saveField/saveFields */
  const trace1 = (label: string) => {
    console.log(`[TRACE 1 ${label}]`, {
      session: session ? { selectedIndustry: session.selectedIndustry, orgName: session.orgName, version: session.version, currentStep: session.currentStep } : null,
      sessionRef: sessionRef.current ? { selectedIndustry: sessionRef.current.selectedIndustry, orgName: sessionRef.current.orgName, version: sessionRef.current.version, currentStep: sessionRef.current.currentStep } : null,
    });
  };

  const saveField = useCallback(<K extends keyof OnboardingSession>(
    key: K,
    value: OnboardingSession[K],
  ) => {
    if (!sessionRef.current) return;
    const next = { ...sessionRef.current, [key]: value };
    sessionRef.current = next;
    setSession(next);
    dirtyRef.current = true;
    trace1(`saveField(${String(key)})`);
  }, []);

  const saveFields = useCallback((data: Partial<OnboardingSession>) => {
    if (!sessionRef.current) return;
    const next = { ...sessionRef.current, ...data };
    sessionRef.current = next;
    setSession(next);
    dirtyRef.current = true;
    trace1(`saveFields(${Object.keys(data).join(',')})`);
  }, []);

  /* TRACE POINT 3 — before persistSession */
  const trace3 = () => {
    console.log('[TRACE 3 before persistSession]', {
      session: session ? { selectedIndustry: session.selectedIndustry, orgName: session.orgName, version: session.version, currentStep: session.currentStep } : null,
      sessionRef: sessionRef.current ? { selectedIndustry: sessionRef.current.selectedIndustry, orgName: sessionRef.current.orgName, version: sessionRef.current.version, currentStep: sessionRef.current.currentStep } : null,
    });
  };

  const persistSession = useCallback(async (): Promise<OnboardingSession | null> => {
    trace3();
    const s = sessionRef.current;
    if (!s || !dirtyRef.current) return s;
    setSaving(true);
    try {
      const updated = await updateSession(s.id, pickPersistFields(s));
      sessionRef.current = updated;
      setSession(updated);
      dirtyRef.current = false;
      return updated;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  /* TRACE POINT 2 — before completeStep */
  const trace2 = () => {
    console.log('[TRACE 2 before completeStep]', {
      session: session ? { selectedIndustry: session.selectedIndustry, orgName: session.orgName, version: session.version, currentStep: session.currentStep } : null,
      sessionRef: sessionRef.current ? { selectedIndustry: sessionRef.current.selectedIndustry, orgName: sessionRef.current.orgName, version: sessionRef.current.version, currentStep: sessionRef.current.currentStep } : null,
    });
  };

  const completeStep = useCallback(async (step: number) => {
    trace2();
    const s = sessionRef.current;
    if (!s) return;
    try {
      const updated = await apiCompleteStep(s.id, step);
      sessionRef.current = updated;
      setSession((prev) => prev ? {
        ...prev,
        currentStep: updated.currentStep,
        completedSteps: updated.completedSteps,
        version: updated.version,
        provisionStatus: updated.provisionStatus,
        organizationId: updated.organizationId,
        provisionData: updated.provisionData,
      } : prev);
      return updated;
    } catch {
      const completed = [...((s).completedSteps ?? []), step];
      const next = s ? { ...s, completedSteps: completed, currentStep: step + 1 } : s;
      if (next) sessionRef.current = next;
      setSession((prev) => prev ? { ...prev, completedSteps: completed, currentStep: step + 1 } : prev);
      return null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const s = sessionRef.current;
    if (s) await loadSession(s.id);
  }, [loadSession]);

  useEffect(() => {
    if (!dirtyRef.current || !sessionRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { persistSession(); }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [session]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (dirtyRef.current && sessionRef.current) {
        updateSession(sessionRef.current.id, pickPersistFields(sessionRef.current)).catch(() => {});
      }
    };
  }, []);

  return {
    session, setSession, loading, saving, error,
    loadSession, loadLatestByEmail, initSession,
    saveField, saveFields, persistSession, completeStep, refreshSession,
  };
}
