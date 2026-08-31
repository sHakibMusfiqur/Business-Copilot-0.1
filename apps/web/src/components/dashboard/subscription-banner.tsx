'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CreditCard, Sparkles, Timer } from 'lucide-react';
import Link from 'next/link';

import { getSubscription } from '@/lib/api';

export function SubscriptionBanner() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => getSubscription(),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) return null;

  if (subscription && subscription.status === 'ACTIVE') {
    return (
      <div className="panel-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-snug tracking-tight">{subscription.plan.name} plan active</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {subscription.billingInterval === 'YEARLY' ? 'Annual billing' : 'Monthly billing'} · renews{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Link
          href="/billing"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-400"
        >
          Manage billing
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="panel-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-snug tracking-tight">Choose a plan to unlock your workspace</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Every plan includes a 30-day free trial — no card required.</p>
          </div>
        </div>
        <Link
          href="/billing"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          View plans
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  const trialOver = subscription.trialDaysRemaining <= 0;
  const trialDays = subscription.trialDaysRemaining;

  return (
    <div className="panel-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${trialOver ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400'}`}>
          <Timer className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug tracking-tight">
            {trialOver ? 'Your free trial has ended' : `${subscription.plan.name} plan — free trial`}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {trialOver
              ? `Your trial of ${subscription.plan.name} ended. Upgrade to keep full access.`
              : trialDays === 1
                ? 'Your free trial ends tomorrow. Upgrade to keep full access.'
                : `Your free trial ends in ${trialDays} days. Upgrade when you are ready.`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="hidden items-center gap-2 lg:flex">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Trial ends</p>
            <p className="flex items-center justify-end gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {trialOver ? 'Today' : trialDays === 1 ? 'Tomorrow' : `${trialDays} days`}
            </p>
          </div>
        </div>

        <Link
          href="/billing"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-xs font-semibold text-white transition-colors ${
            trialOver ? 'bg-amber-500 hover:bg-amber-400' : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {trialOver ? 'Upgrade now' : 'Upgrade / view billing'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}