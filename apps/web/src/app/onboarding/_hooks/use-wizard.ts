'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef } from 'react';

export const STEP_PATHS = [
  '/onboarding/verify',
  '/onboarding/industry',
  '/onboarding/org-info',
  '/onboarding/profile',
  '/onboarding/ai',
  '/onboarding/plan',
  '/onboarding/provisioning',
  '/onboarding/success',
] as const;

export const STEP_LABELS = [
  'Verify', 'Industry', 'Organization',
  'Profile', 'AI', 'Plan', 'Provision', 'Done',
] as const;

export function pathToStep(pathname: string): number {
  const idx = STEP_PATHS.indexOf(pathname as (typeof STEP_PATHS)[number]);
  return idx >= 0 ? idx : 0;
}

export function useWizard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isNavigatingRef = useRef(false);

  const currentStep = useMemo(() => pathToStep(pathname), [pathname]);

  const buildUrl = useCallback((step: number): string => {
    const path = STEP_PATHS[step] ?? STEP_PATHS[0];
    const params = new URLSearchParams(searchParams.toString());
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }, [searchParams]);

  const goTo = useCallback((step: number) => {
    if (step < 0 || step >= STEP_PATHS.length) return;
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push(buildUrl(step));
    setTimeout(() => { isNavigatingRef.current = false; }, 300);
  }, [router, buildUrl]);

  const goNext = useCallback(() => goTo(Math.min(currentStep + 1, STEP_PATHS.length - 1)), [goTo, currentStep]);
  const goBack = useCallback(() => goTo(Math.max(currentStep - 1, 0)), [goTo, currentStep]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEP_PATHS.length - 1;
  const nextStep = Math.min(currentStep + 1, STEP_PATHS.length - 1);
  const prevStep = Math.max(currentStep - 1, 0);
  const nextPath = STEP_PATHS[nextStep];
  const prevPath = STEP_PATHS[prevStep];

  return {
    currentStep, goTo, goNext, goBack,
    isFirstStep, isLastStep, nextStep, prevStep, nextPath, prevPath,
  };
}
