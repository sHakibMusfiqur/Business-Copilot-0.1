'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Circle, ClipboardCheck, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { useAuthStore } from '@/store/auth-store';
import { getChecklist, getChecklistProgress, getSessionByEmail, type ChecklistItem, type ChecklistProgress } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

export function OnboardingWidget() {
  const user = useAuthStore((s) => s.user);
  const userEmail = user?.email;

  // The onboarding checklist belongs to the org owner who ran onboarding. The
  // session id is persisted in sessionStorage (same tab) when onboarding
  // succeeds. Regular (non-owner) members never hold this session in storage,
  // and only the owner's session carries an onboarding token, so the checklist
  // naturally stays hidden for everyone else.
  const storedSessionId = getOnboardingSession()?.id ?? null;

  // Incomplete user: keep the inline "Resume Onboarding" banner.
  const sessionQuery = useQuery({
    queryKey: ['onboarding', 'session', userEmail],
    queryFn: () => getSessionByEmail(userEmail as string),
    enabled: !!userEmail,
    retry: false,
    staleTime: 0,
  });
  const session = sessionQuery.data;
  const sessionId = session?.id ?? storedSessionId;

  if (
    session &&
    (session.provisionStatus === 'PENDING' || session.provisionStatus === 'PROVISIONING') &&
    session.id === sessionId
  ) {
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

  // No persisted (completed) session -> nothing to show for this user.
  if (!storedSessionId) return null;

  // One query keyed on the scope the settings pages invalidate, so a single
  // cache invalidation keeps both the item list and the counts fresh.
  const dataQuery = useQuery({
    queryKey: ['onboarding', 'checklist-progress', storedSessionId],
    queryFn: async () => {
      const [checklist, progress] = await Promise.all([
        getChecklist(storedSessionId as string),
        getChecklistProgress(storedSessionId as string),
      ]);
      return { items: checklist, progress };
    },
    enabled: !!storedSessionId,
    staleTime: 0,
  });

  if (dataQuery.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const { items, progress } = dataQuery.data ?? { items: [] as ChecklistItem[], progress: null as ChecklistProgress | null };
  if (!progress || progress.total === 0 || progress.percentage === 100) return null;

  const { total, completed } = progress;
  const percentage = Math.min(100, Math.max(0, progress.percentage));

  const firstIncomplete = items.find((i) => !i.completed);
  const continueHref = firstIncomplete?.href ?? '/dashboard';

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <ClipboardCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Workspace Setup Checklist</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {completed} of {total} tasks complete
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-bold text-emerald-600">{percentage}%</span>
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(241 245 249)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none" stroke="rgb(16 185 129)" strokeWidth="3"
              strokeDasharray={94.2}
              strokeDashoffset={94.2 - (94.2 * percentage) / 100}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
            <text x="18" y="20.5" textAnchor="middle" className="fill-slate-700 text-[8px] font-bold">
              {percentage}%
            </text>
          </svg>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
          >
            {item.completed ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-3 w-3 text-white" />
              </span>
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-slate-200" />
            )}
            <span className={`min-w-0 flex-1 truncate text-xs ${item.completed ? 'text-slate-400' : 'text-slate-700'}`}>
              {item.label}
            </span>
            {!item.completed && item.href && (
              <Link
                href={item.href}
                aria-label={`Go to ${item.label}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-600 opacity-0 transition-opacity hover:bg-emerald-50 group-hover:opacity-100"
              >
                Setup
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {continueHref && (
        <div className="mt-4">
          <Link
            href={continueHref}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
          >
            Continue Setup
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}