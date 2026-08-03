'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Check, ChevronRight, ClipboardCheck, Loader2, Sparkles, ArrowRight,
  Palette, Users, Bell, Mail, Upload, Shield, Sliders, Percent,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { useAuthStore } from '@/store/auth-store';
import { getChecklist, getChecklistProgress, getSessionByEmail, type ChecklistItem, type ChecklistProgress } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { cn } from '@/lib/utils';

const ITEM_ICONS: Record<string, LucideIcon> = {
  branding: Palette,
  logo: Palette,
  team: Users,
  notifications: Bell,
  email: Mail,
  data: Upload,
  roles: Shield,
  preferences: Sliders,
  tax: Percent,
};

export function OnboardingWidget() {
  const user = useAuthStore((s) => s.user);
  const userEmail = user?.email;

  const storedSessionId = getOnboardingSession()?.id ?? null;

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
      <div className="panel-card flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-amber-500/10 text-amber-500 dark:text-amber-400">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Complete Your Onboarding</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Step {session.currentStep} of 11 — Set up your organization to unlock all features
          </p>
          <div className="mt-2.5">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-400"
            >
              Resume Onboarding
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!storedSessionId) return null;

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
      <div className="panel-card flex items-center justify-center p-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
    <div className="panel-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight">Workspace Setup</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{completed} of {total} tasks complete</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06] sm:block">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="relative h-11 w-11">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(100,116,139,0.18)" strokeWidth="3.5" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3.5"
                strokeDasharray={94.2}
                strokeDashoffset={94.2 - (94.2 * percentage) / 100}
                strokeLinecap="round"
                className="text-primary transition-all duration-300"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{percentage}%</span>
          </div>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = ITEM_ICONS[item.itemId] ?? Shield;
          return (
            <li
              key={item.id}
              className={cn(
                'flex h-12 items-center gap-2.5 rounded-xl border px-3 transition-colors',
                item.completed
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]'
                  : 'border-border bg-card hover:border-slate-300 dark:bg-white/[0.02] dark:hover:border-white/[0.16]',
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                  item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500',
                )}
              >
                {item.completed ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', item.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300')}>
                {item.label}
              </span>
              {!item.completed && item.href && (
                <Link
                  href={item.href}
                  aria-label={`Go to ${item.label}`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  Go
                  <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {continueHref && (
        <div className="mt-4">
          <Link
            href={continueHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
          >
            Continue Setup
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}