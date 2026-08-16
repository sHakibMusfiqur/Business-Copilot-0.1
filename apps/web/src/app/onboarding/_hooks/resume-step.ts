'use client';

import type { OnboardingSession } from '@/lib/onboarding-api';

import { STEP_PATHS } from './use-wizard';

/** Provisioning step index: never let a pending session land on Success (8). */
export const PROVISIONING_STEP = 7;


export function resolveResumeStep(
  session: Pick<OnboardingSession, 'currentStep' | 'provisionStatus'>,
): number {
  if (session.provisionStatus === 'PROVISIONING') return PROVISIONING_STEP;
  const raw = session.currentStep;
  const step = Math.min(typeof raw === 'number' ? raw : 0, PROVISIONING_STEP);
  return Math.max(step, 0);
}

/** Builds the resume URL for a pending session. Only the session id (a cuid,
 * never the onboarding token) is placed in the URL query. */
export function resumePath(session: OnboardingSession): string {
  return `${STEP_PATHS[resolveResumeStep(session)]}?session=${session.id}`;
}