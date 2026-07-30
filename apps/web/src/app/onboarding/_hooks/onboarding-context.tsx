'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { useWizard } from './use-wizard';
import type { useOnboardingSession } from './use-onboarding-session';

type WizardReturn = ReturnType<typeof useWizard>;
type SessionReturn = ReturnType<typeof useOnboardingSession>;

interface OnboardingContextValue {
  wizard: WizardReturn;
  session: SessionReturn['session'];
  loading: SessionReturn['loading'];
  saving: SessionReturn['saving'];
  error: SessionReturn['error'];
  saveField: SessionReturn['saveField'];
  saveFields: SessionReturn['saveFields'];
  completeStep: SessionReturn['completeStep'];
  initSession: SessionReturn['initSession'];
  refreshSession: SessionReturn['refreshSession'];
  persistSession: SessionReturn['persistSession'];
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  wizard,
  sessionData,
  children,
}: {
  wizard: WizardReturn;
  sessionData: SessionReturn;
  children: ReactNode;
}) {
  return (
    <OnboardingContext.Provider
      value={{
        wizard,
        session: sessionData.session,
        loading: sessionData.loading,
        saving: sessionData.saving,
        error: sessionData.error,
        saveField: sessionData.saveField,
        saveFields: sessionData.saveFields,
        completeStep: sessionData.completeStep,
        initSession: sessionData.initSession,
        refreshSession: sessionData.refreshSession,
        persistSession: sessionData.persistSession,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
