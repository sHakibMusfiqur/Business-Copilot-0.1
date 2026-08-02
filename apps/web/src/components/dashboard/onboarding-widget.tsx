'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { getSessionByEmail, getChecklistProgress } from '@/lib/onboarding-api';

export function OnboardingWidget() {
  const user = useAuthStore((s) => s.user);
  const userEmail = user?.email;

  const sessionQuery = useQuery({
    queryKey: ['onboarding', 'session', userEmail],
    queryFn: () => getSessionByEmail(userEmail as string),
    enabled: !!userEmail,
    retry: false,
    staleTime: 0,
  });

  const session = sessionQuery.data;
  const sessionId = session?.id;

  const checklistQuery = useQuery({
    queryKey: ['onboarding', 'checklist-progress', sessionId],
    queryFn: () => getChecklistProgress(sessionId as string),
    enabled: !!sessionId && session?.provisionStatus === 'COMPLETED',
  });

  if (sessionQuery.isLoading) return null;

  if (!session) return null;

  if (session.provisionStatus === 'PENDING' || session.provisionStatus === 'PROVISIONING') {
    return (
      <div className="rounded-2xl border border-red-100/50 shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex items-start gap-4 bg-gradient-to-r from-red-50/50 to-amber-50/50">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
          <Sparkles className="h-5 w-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Complete Your Onboarding</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Step {session.currentStep} of 11 — Set up your organization to unlock all features
          </p>
          <div className="mt-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600 transition-colors"
            >
              Resume Onboarding
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (session.provisionStatus === 'COMPLETED' && checklistQuery.data) {
    const { total, completed } = checklistQuery.data;
    if (total === 0) return null;
    const percentage = Math.min(100, Math.max(0, checklistQuery.data.percentage));

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">Getting Started Checklist</h3>
              <p className="text-xs text-slate-500 mt-0.5">{completed}/{total} tasks complete</p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-bold text-emerald-600">{percentage}%</span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {percentage < 100 && (
          <div className="mt-3">
            <Link
              href={`/onboarding/success?session=${session.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View Checklist
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    );
  }

  return null;
}
