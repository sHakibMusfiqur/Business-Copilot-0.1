'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/auth-store';

export default function DashboardIndexPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'SUPER_ADMIN') {
      router.replace('/admin');
    } else if (user.onboardingCompleted) {
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding');
    }
  }, [user, router]);

  return null;
}
