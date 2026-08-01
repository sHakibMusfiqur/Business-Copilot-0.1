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

  // Active paid subscription — always surface a "Manage billing" affordance.
  if (subscription && subscription.status === 'ACTIVE') {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                {subscription.plan.name} plan active
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {subscription.billingInterval === 'YEARLY' ? 'Annual billing' : 'Monthly billing'} · renews{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Manage billing
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // No subscription — prompt to pick a plan.
  if (!subscription) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">Choose a plan to unlock your workspace</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every plan includes a 30-day free trial — no card required.
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            View plans
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Trial or expired/cancelled.
  const trialOver = subscription.trialDaysRemaining <= 0;
  const trialDays = subscription.trialDaysRemaining;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${trialOver ? 'border-amber-100 bg-amber-50/60' : 'border-blue-100 bg-blue-50/60'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${trialOver ? 'bg-amber-100' : 'bg-blue-100'}`}>
            <Timer className={`h-5 w-5 ${trialOver ? 'text-amber-600' : 'text-blue-600'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              {trialOver
                ? 'Your free trial has ended'
                : `${subscription.plan.name} plan — free trial`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {trialOver
                ? `Your trial of ${subscription.plan.name} ended. Upgrade to keep full access.`
                : trialDays === 1
                  ? 'Your free trial ends tomorrow. Upgrade to keep full access.'
                  : `Your free trial ends in ${trialDays} days. Upgrade when you are ready.`}
            </p>
          </div>
        </div>
        <Link
          href="/billing"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-white transition-colors ${trialOver ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {trialOver ? 'Upgrade now' : 'Upgrade / view billing'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
