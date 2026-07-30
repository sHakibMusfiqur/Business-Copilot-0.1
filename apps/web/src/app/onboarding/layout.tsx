'use client';

import { Suspense, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { StepWizard } from '@/components/onboarding/step-wizard';
import { pathToStep, useWizard } from './_hooks/use-wizard';
import { useOnboardingSession } from './_hooks/use-onboarding-session';
import { OnboardingProvider } from './_hooks/onboarding-context';

let layoutMountCount = 0;
function OnboardingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wizard = useWizard();
  const sessionData = useOnboardingSession();
  const currentStep = pathToStep(pathname);
  const isSuccess = currentStep === 7;
  const mountId = useRef(++layoutMountCount);
  useEffect(() => { console.log('[LAYOUT MOUNT] id=', mountId.current, ' pathname=', pathname, ' session=', { selectedIndustry: sessionData.session?.selectedIndustry, orgName: sessionData.session?.orgName, version: sessionData.session?.version, currentStep: sessionData.session?.currentStep }); }, []);

  return (
    <OnboardingProvider wizard={wizard} sessionData={sessionData}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {!isSuccess && (
            <StepWizard
              currentStep={currentStep}
              completedSteps={sessionData.session?.completedSteps ?? []}
            />
          )}
          <main className="mt-4">{children}</main>
        </div>
      </div>
    </OnboardingProvider>
  );
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <OnboardingShell>{children}</OnboardingShell>
    </Suspense>
  );
}
