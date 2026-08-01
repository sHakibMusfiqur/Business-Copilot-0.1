'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Info, Layers, LayoutGrid, Loader2, Sparkles,
  Users, HardDrive, Zap, Shield,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import {
  getBillingPlans, getPaymentGateways, startFreeTrial,
  type SubscriptionPlanResponse,
} from '@/lib/api';
import { detectCurrency } from '@/lib/currency';
import { AllPlansDialog } from './all-plans-dialog';
import { ComparePlansDialog } from './compare-plans-dialog';
import { PlanDetailDialog } from './plan-detail-dialog';
import {
  formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval,
} from './plan-utils';

type Phase = 'plans' | 'payment';

function FeaturedPlanCard({
  plan,
  interval,
  currency,
  onSeeOtherPlans,
  onViewDetails,
  onContinue,
  loading,
}: {
  plan: SubscriptionPlanResponse;
  interval: BillingInterval;
  currency: string;
  onSeeOtherPlans: () => void;
  onViewDetails: () => void;
  onContinue: () => void;
  loading?: boolean;
}) {
  const features = plan.modules && plan.modules.length > 0 ? plan.modules.slice(0, 5) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-md"
    >
      <div className={`absolute -inset-px rounded-3xl bg-gradient-to-br ${
        plan.recommended
          ? 'from-blue-500/60 via-indigo-500/40 to-fuchsia-500/50'
          : 'from-slate-500/40 via-slate-600/20 to-slate-500/40'
      } blur-sm`} aria-hidden="true" />

      <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-2xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden="true" />

        {plan.recommended && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-500/30">
            <Sparkles className="h-3 w-3" /> Recommended
          </span>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
          {plan.freeTrialDays > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
              {plan.freeTrialDays}-day free trial
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{plan.description}</p>

        <div className="mt-6 flex items-end gap-1">
          <span className="text-4xl font-bold tracking-tight text-white">
            {formatPlanPrice(plan, interval, currency)}
          </span>
          <span className="pb-1 text-sm text-slate-400">/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <Users className="h-3 w-3 text-blue-400" /> Users
            </div>
            <p className="mt-1 text-lg font-semibold text-white">{formatUsers(plan.maxUsers)}</p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <HardDrive className="h-3 w-3 text-blue-400" /> Storage
            </div>
            <p className="mt-1 text-lg font-semibold text-white">{formatStorage(plan.maxStorage)}</p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <Zap className="h-3 w-3 text-amber-400" /> AI Credits
            </div>
            <p className="mt-1 text-lg font-semibold text-white">
              {plan.aiCredits > 0 ? plan.aiCredits.toLocaleString() : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <Shield className="h-3 w-3 text-emerald-400" /> Reports
            </div>
            <p className="mt-1 text-lg font-semibold text-white">{plan.reportsEnabled ? 'Advanced' : 'Basic'}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-2.5">
          {features.map((m) => (
            <li key={m} className="flex items-center gap-2.5 text-sm text-slate-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {moduleLabel(m)}
            </li>
          ))}
          {plan.apiAccess && (
            <li className="flex items-center gap-2.5 text-sm text-slate-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" /> API access
            </li>
          )}
          {plan.prioritySupport && (
            <li className="flex items-center gap-2.5 text-sm text-slate-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" /> Priority support
            </li>
          )}
        </ul>

        <div className="mt-8 space-y-3">
          <button
            onClick={onContinue}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {loading ? 'Starting your free trial…' : `Continue with ${plan.name}`}
          </button>
          <button
            onClick={onSeeOtherPlans}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition-colors hover:border-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <LayoutGrid className="h-4 w-4" /> See Other Plans
          </button>
          <button
            onClick={onViewDetails}
            className="flex w-full items-center justify-center gap-1.5 text-center text-sm text-slate-400 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <Info className="h-3.5 w-3.5" /> View full {plan.name} plan details
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function PlanPage() {
  const { wizard, session, saveField, completeStep, persistSession } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(session?.selectedPlanId ?? null);
  const [annual, setAnnual] = useState<BillingInterval>(
    (session?.planInterval as BillingInterval) ?? 'MONTHLY',
  );
  const [phase, setPhase] = useState<Phase>('plans');
  const [allPlansOpen, setAllPlansOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<SubscriptionPlanResponse | null>(null);
  const [starting, setStarting] = useState(false);

  const currency = useMemo(() => detectCurrency(session), [session]);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => getBillingPlans(),
    staleTime: 60_000,
  });

  const { data: gateways } = useQuery({
    queryKey: ['billing', 'gateways'],
    queryFn: () => getPaymentGateways(),
    staleTime: 60_000,
  });

  const paymentEnabled = useMemo(
    () => gateways?.some((g) => g.isEnabled) ?? false,
    [gateways],
  );

  const recommended = useMemo(() => plans?.find((p) => p.recommended) ?? plans?.[0] ?? null, [plans]);
  const selectedPlan = useMemo(() => plans?.find((p) => p.id === selected) ?? null, [plans, selected]);
  const featured = selectedPlan ?? recommended;

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleSelect = (planId: string) => {
    setSelected(planId);
    saveField('selectedPlanId', planId);
    saveField('planInterval', annual);
  };

  const activateTrial = async () => {
    if (!featured) return;
    saveField('selectedPlanId', featured.id);
    saveField('planInterval', annual);
    try {
      await startFreeTrial(featured.id, annual);
    } catch {
      // Payment is not implemented and provisioning will create the trial
      // subscription, so a failed trial call must not block onboarding.
    }
    await persistSession();
    await completeStep(5);
    wizard.goNext();
  };

  const handleContinue = async () => {
    if (!featured || starting) return;
    if (!paymentEnabled) {
      setStarting(true);
      try {
        await activateTrial();
      } finally {
        setStarting(false);
      }
      return;
    }
    saveField('selectedPlanId', featured.id);
    saveField('planInterval', annual);
    setPhase('payment');
  };

  const handleSkipToTrial = async () => {
    if (!featured) return;
    saveField('selectedPlanId', featured.id);
    saveField('planInterval', annual);
    try {
      await startFreeTrial(featured.id, annual);
    } catch {
      // Non-blocking: provisioning will ensure the trial subscription exists.
    }
    await persistSession();
    await completeStep(5);
    wizard.goNext();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="mx-auto max-w-3xl pt-8">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold text-white">No plans available</h2>
          <p className="text-sm text-slate-400">Plans are not configured yet. Please contact support.</p>
        </div>
      </div>
    );
  }

  if (phase === 'payment') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl pt-8">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
          <h2 className="mb-1 text-2xl font-bold text-white">Payment</h2>
          <p className="mb-6 text-sm text-slate-400">Complete your subscription setup</p>

          {featured && (
            <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{featured.name} plan</span>
                <span className="text-xs text-slate-400">{annual === 'YEARLY' ? 'Annual' : 'Monthly'}</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">{formatPlanPrice(featured, annual, currency)}</span>
                  <span className="text-sm text-slate-400">/{annual === 'YEARLY' ? 'yr' : 'mo'}</span>
                </div>
                <span className="text-xs text-emerald-400">{featured.freeTrialDays}-day free trial</span>
              </div>
            </div>
          )}

          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Online payment is not available yet. Stripe, SSLCommerz, bKash, Nagad and card payments are
                coming soon. Start your free trial now — you can add a payment method later from Billing.
              </span>
            </p>
          </div>

          <div className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment methods</p>
            <div className="space-y-2">
              {['Card (Stripe)', 'SSLCommerz', 'bKash', 'Nagad'].map((g) => (
                <div key={g} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2.5 opacity-60">
                  <span className="text-sm text-slate-300">{g}</span>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">Coming soon</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSkipToTrial}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-500 hover:to-green-500"
            >
              <Sparkles className="h-4 w-4" /> Skip for Now — Start Free Trial
            </button>
            <button
              onClick={() => setPhase('plans')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Plans
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl pt-8">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
            <p className="mt-1 text-sm text-slate-400">Every plan includes a free trial — pricing shown in {currency}</p>
          </div>
          <button
            onClick={() => setCompareOpen(true)}
            className="hidden items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white sm:flex"
          >
            <Layers className="h-4 w-4" /> Compare all plans
          </button>
        </div>

        <div className="mb-8 mt-4 flex items-center justify-center gap-3">
          <span className={`text-sm ${annual === 'MONTHLY' ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(annual === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
            className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${annual === 'YEARLY' ? 'bg-blue-600' : 'bg-slate-600'}`}
            aria-label="Toggle annual billing"
          >
            <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${annual === 'YEARLY' ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm ${annual === 'YEARLY' ? 'text-white' : 'text-slate-400'}`}>
            Annual <span className="text-green-400">(save 2 months)</span>
          </span>
        </div>

        {featured && (
          <FeaturedPlanCard
            plan={featured}
            interval={annual}
            currency={currency}
            onSeeOtherPlans={() => setAllPlansOpen(true)}
            onViewDetails={() => setDetailPlan(featured)}
            onContinue={handleContinue}
            loading={starting}
          />
        )}

        <div className="mt-4 flex items-center justify-center gap-4 sm:hidden">
          <button
            onClick={() => setCompareOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300"
          >
            <Layers className="h-4 w-4" /> Compare all plans
          </button>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {featured && (
            <button
              onClick={handleContinue}
              disabled={starting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <AllPlansDialog
        plans={plans}
        open={allPlansOpen}
        onClose={() => setAllPlansOpen(false)}
        interval={annual}
        currency={currency}
        selectedPlanId={selected}
        onSelect={handleSelect}
      />
      <ComparePlansDialog
        plans={plans}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        interval={annual}
        currency={currency}
        variant="dark"
      />
      <PlanDetailDialog
        plan={detailPlan}
        open={detailPlan !== null}
        onClose={() => setDetailPlan(null)}
        onSelect={(planId) => handleSelect(planId)}
        currency={currency}
      />
    </motion.div>
  );
}
