'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OnboardingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = searchParams.get('session');

  useEffect(() => {
    const target = session ? `/onboarding/verify?session=${session}` : '/onboarding/verify';
    router.replace(target);
  }, [router, session]);

  return null;
}
