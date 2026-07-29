'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSession, getSessionByEmail, createSession, updateSession,
  completeStep as apiCompleteStep,
  type OnboardingSession,
} from '@/lib/onboarding-api';

const SAVE_DEBOUNCE_MS = 2000;

export function useOnboardingSession() {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setSession(s);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/onboarding?session=${s.id}`);
      }
      return s;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveField = useCallback(<K extends keyof OnboardingSession>(
    key: K,
    value: OnboardingSession[K],
  ) => {
    if (!session) return;
    setSession((prev) => (prev ? { ...prev, [key]: value } : prev));
    dirtyRef.current = true;
  }, [session]);

  const saveBatch = useCallback((data: Partial<OnboardingSession>) => {
    if (!session) return;
    setSession((prev) => (prev ? { ...prev, ...data } : prev));
    dirtyRef.current = true;
  }, [session]);

  const persistSession = useCallback(async (): Promise<OnboardingSession | null> => {
    if (!session || !dirtyRef.current) return session;
    setSaving(true);
    try {
      const updated = await updateSession(session.id, {
        currentStep: session.currentStep,
        selectedIndustry: session.selectedIndustry,
        selectedCategory: session.selectedCategory,
        orgName: session.orgName,
        orgEmail: session.orgEmail,
        orgPhone: session.orgPhone,
        orgWebsite: session.orgWebsite,
        orgCountry: session.orgCountry,
        orgState: session.orgState,
        orgCity: session.orgCity,
        orgAddress: session.orgAddress,
        orgTimezone: session.orgTimezone,
        orgCurrency: session.orgCurrency,
        orgLanguage: session.orgLanguage,
        businessProfile: session.businessProfile,
        selectedModules: session.selectedModules,
        aiEnabled: session.aiEnabled,
        aiLanguage: session.aiLanguage,
        aiPersonality: session.aiPersonality,
        selectedPlanId: session.selectedPlanId,
      });
      setSession(updated);
      dirtyRef.current = false;
      return updated;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }, [session]);

  const completeStep = useCallback(async (step: number) => {
    if (!session) return;
    try {
      const updated = await apiCompleteStep(session.id, step);
      setSession(updated);
      return updated;
    } catch {
      const completed = [...(session.completedSteps ?? []), step];
      setSession((prev) => prev ? { ...prev, completedSteps: completed, currentStep: step + 1 } : prev);
      return null;
    }
  }, [session]);

  const refreshSession = useCallback(async () => {
    if (session) await loadSession(session.id);
  }, [session, loadSession]);

  useEffect(() => {
    if (!dirtyRef.current || !session) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { persistSession(); }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [session, persistSession]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (dirtyRef.current && session) {
          updateSession(session.id, {
            currentStep: session.currentStep,
            selectedIndustry: session.selectedIndustry,
          }).catch(() => {});
        }
      }
    };
  }, [session]);

  return {
    session, setSession, loading, saving, error,
    loadSession, loadLatestByEmail, initSession,
    saveField, saveBatch, persistSession, completeStep, refreshSession,
  };
}
