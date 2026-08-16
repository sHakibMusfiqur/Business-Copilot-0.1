import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/onboarding',
  useSearchParams: () => new URLSearchParams(),
}));

import { resolveResumeStep, resumePath, PROVISIONING_STEP } from './resume-step';
import { STEP_PATHS } from './use-wizard';

type ResumeSession = Parameters<typeof resumePath>[0];

function session(
  overrides: { currentStep?: number; provisionStatus?: string; id?: string } = {},
): ResumeSession {
  return {
    id: overrides.id ?? 'cm-session-123',
    currentStep: overrides.currentStep ?? 0,
    provisionStatus: overrides.provisionStatus ?? 'PENDING',
  } as ResumeSession;
}

describe('resolveResumeStep', () => {
  it('resumes a pending session with currentStep=3 at the STEP_PATHS[3] index (not Verify)', () => {
    const step = resolveResumeStep(session({ currentStep: 3 }));
    expect(step).toBe(3);
    expect(STEP_PATHS[step]).toBe('/onboarding/profile');
  });

  it('resumes a pending session with currentStep=6 at the Payment index', () => {
    const step = resolveResumeStep(session({ currentStep: 6 }));
    expect(step).toBe(6);
    expect(STEP_PATHS[step]).toBe('/onboarding/payment');
  });

  it('resumes an actively provisioning session at the Provisioning step', () => {
    expect(resolveResumeStep(session({ currentStep: 0, provisionStatus: 'PROVISIONING' }))).toBe(
      PROVISIONING_STEP,
    );
  });

  it('never returns the Success step (8) for a still-pending session', () => {
    const step = resolveResumeStep(session({ currentStep: 8 }));
    expect(step).toBe(PROVISIONING_STEP);
    expect(step).toBeLessThan(8);
  });

  it('clamps a negative currentStep to Verify (0)', () => {
    expect(resolveResumeStep(session({ currentStep: -1 }))).toBe(0);
  });

  it('maps a completed provisioning status (COMPLETED) to the Provisioning index, not Success', () => {
    // The COMPLETED->dashboard case is handled by the resolver before this
    // helper is reached; this asserts the helper never forwards to Success.
    expect(resolveResumeStep(session({ currentStep: 8, provisionStatus: 'COMPLETED' }))).toBeLessThan(8);
  });
});

describe('resumePath', () => {
  it('resumes a currentStep=3 session at STEP_PATHS[3], not Verify', () => {
    expect(resumePath(session({ currentStep: 3 }))).toBe('/onboarding/profile?session=cm-session-123');
  });

  it('resumes a currentStep=6 session at Payment', () => {
    expect(resumePath(session({ currentStep: 6 }))).toBe('/onboarding/payment?session=cm-session-123');
  });

  it('resumes a provisioning-active session at /onboarding/provisioning', () => {
    expect(resumePath(session({ provisionStatus: 'PROVISIONING' }))).toBe(
      '/onboarding/provisioning?session=cm-session-123',
    );
  });

  it('keeps the session query parameter present', () => {
    expect(resumePath(session({ currentStep: 2, id: 'cm-abc' }))).toContain('?session=cm-abc');
  });

  it('never places the onboarding token in the URL', () => {
    const resume = session({ currentStep: 5 });
    (resume as { onboardingToken?: string }).onboardingToken = 'secret-onboarding-token';
    const url = resumePath(resume);
    expect(url).not.toContain('secret-onboarding-token');
    expect(url).not.toContain('token=');
  });
});