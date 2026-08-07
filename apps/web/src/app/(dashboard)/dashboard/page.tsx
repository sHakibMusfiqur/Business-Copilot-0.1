'use client';

import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { OnboardingWidget } from '@/components/dashboard/onboarding-widget';
import { SubscriptionBanner } from '@/components/dashboard/subscription-banner';
import { ExecutiveWorkspace } from '@/components/workspace/executive-workspace';
import type { DashboardOverview } from '@/components/dashboard/types';
import { useCopilotActions } from '@/core/workspace/copilot-actions';
import { getDashboardOverview } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const runCommand = useCopilotActions();

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => getDashboardOverview(),
  });

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, router]);

  if (user?.role === 'SUPER_ADMIN') return null;

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    return (
      <DashboardError
        status={status}
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <OnboardingWidget />
      <SubscriptionBanner />
      <ExecutiveWorkspace overview={data} onCommand={runCommand} />
    </div>
  );
}
