'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Info, Loader2, Sparkles, Shield,
  Layers, Users, HardDrive, Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { getBillingPlans, type SubscriptionPlanResponse } from '@/lib/api';
import { ComparePlansDialog } from './compare-plans-dialog';
import { PlanDetailDialog } from './plan-detail-dialog';
import {
  formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval,
} from './plan-utils';

type Phase = 'plans' | 'payment';

function PlanCard({ plan, selected, onSelect, interval }: {
  plan: SubscriptionPlanResponse;
  selected: boolean;
  onSelect: () => void;
  interval: BillingInterval;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col rounded-xl border p-6 text-left transition-all ${
        selected
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
          : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
      }`}
    >
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-0.5 text-xs font-medium text-white">
          Recommended
        </div>
      )}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
        {plan.freeTrialDays > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            {plan.freeTrialDays}-day trial
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">{plan.description}</p>
      <p className="mb-1">
        <span className="text-3xl font-bold text-white">{formatPlanPrice(plan, interval)}</span>
        <span className="text-sm text-slate-400">/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {formatUsers(plan.maxUsers)} users</span>
        <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {formatStorage(plan.maxStorage)}</span>
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {plan.aiCredits > 0 ? `${plan.aiCredits} AI credits` : 'AI —'}</span>
        <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {plan.reportsEnabled ? 'Reports' : 'Basic reports'}</span>
      </div>

      <div className="mb-4 space-y-2 flex-1">
        {(plan.modules && plan.modules.length > 0 ? plan.modules.slice(0, 4) : []).map((m) => (
          <li key={m} className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="h-3.5 w-3.5 shrink-0 text-green-400" /> {moduleLabel(m)}
          </li>
        ))}
        {plan.apiAccess && (
          <li className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="h-3.5 w-3.5 shrink-0 text-green-400" /> API access
          </li>
        )}
        {plan.prioritySupport && (
          <li className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="h-3.5 w-3.5 shrink-0 text-green-400" /> Priority support
          </li>
        )}
        {plan.customBranding && (
          <li className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="h-3.5 w-3.5 shrink-0 text-green-400" /> Custom branding
          </li>
        )}
      </div>

      <div className={`mt-auto flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-colors ${
        selected ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 text-slate-300 group-hover:border-slate-500'
      }`}>
        {selected ? 'Selected' : 'Select'}
      </div>
    </button>
  );
}

export default function PlanPage() {
  const { wizard, session, saveField, completeStep, persistSession } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(session?.selectedPlanId ?? null);
  const [annual, setAnnual] = useState<BillingInterval>(
    (session?.planInterval as BillingInterval) ?? 'MONTHLY',
  );
  const [phase, setPhase] = useState<Phase>('plans');
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<SubscriptionPlanResponse | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => getBillingPlans(),
    staleTime: 60_000,
  });

  const recommended = useMemo(() => plans?.find((p) => p.recommended), [plans]);
  const activeSelected = selected ?? recommended?.id ?? plans?.[0]?.id ?? null;
  const selectedPlan = plans?.find((p) => p.id === activeSelected) ?? null;

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleContinue = async () => {
    if (!activeSelected) return;
    saveField('selectedPlanId', activeSelected);
    saveField('planInterval', annual);
    setPhase('payment');
  };

  const handleSkipToTrial = async () => {
    if (!activeSelected) return;
    saveField('selectedPlanId', activeSelected);
    saveField('planInterval', annual);
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

          {selectedPlan && (
            <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{selectedPlan.name} plan</span>
                <span className="text-xs text-slate-400">{annual === 'YEARLY' ? 'Annual' : 'Monthly'}</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">{formatPlanPrice(selectedPlan, annual)}</span>
                  <span className="text-sm text-slate-400">/{annual === 'YEARLY' ? 'yr' : 'mo'}</span>
                </div>
                <span className="text-xs text-emerald-400">{selectedPlan.freeTrialDays}-day free trial</span>
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
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
            <p className="mt-1 text-sm text-slate-400">Pick the plan that fits your business — every plan includes a free trial</p>
          </div>
          <button
            onClick={() => setCompareOpen(true)}
            className="hidden items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white sm:flex"
          >
            <Layers className="h-4 w-4" /> Compare all plans
          </button>
        </div>

        <div className="mb-6 mt-4 flex items-center justify-center gap-3">
          <span className={`text-sm ${annual === 'MONTHLY' ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(annual === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
            className={`relative h-6 w-11 rounded-full transition-colors ${annual === 'YEARLY' ? 'bg-blue-600' : 'bg-slate-600'}`}
            aria-label="Toggle annual billing"
          >
            <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${annual === 'YEARLY' ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm ${annual === 'YEARLY' ? 'text-white' : 'text-slate-400'}`}>
            Annual <span className="text-green-400">(save 2 months)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={activeSelected === plan.id}
              onSelect={() => setSelected(plan.id)}
              interval={annual}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 sm:hidden">
          <button
            onClick={() => setCompareOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300"
          >
            <Layers className="h-4 w-4" /> Compare all plans
          </button>
        </div>

        {selectedPlan && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setDetailPlan(selectedPlan)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 text-center text-sm text-slate-400 transition-colors hover:text-white"
          >
            <Info className="h-3.5 w-3.5" /> View full {selectedPlan.name} plan details
          </motion.button>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!activeSelected}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ComparePlansDialog plans={plans} open={compareOpen} onClose={() => setCompareOpen(false)} interval={annual} />
      <PlanDetailDialog plan={detailPlan} open={detailPlan !== null} onClose={() => setDetailPlan(null)} interval={annual} />
    </motion.div>
  );
}
