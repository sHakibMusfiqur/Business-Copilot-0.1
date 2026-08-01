'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, HardDrive, Layers, LayoutGrid, Loader2, Shield,
  Sparkles, Users, Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { getBillingPlans, type SubscriptionPlanResponse } from '@/lib/api';
import { detectCurrency } from '@/lib/currency';
import { AllPlansDialog } from './all-plans-dialog';
import { ComparePlansDialog } from './compare-plans-dialog';
import {
  formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval,
} from './plan-utils';

const VISIBLE_PLAN_SLUGS = ['starter', 'growth', 'professional'];

function PlanCard({
  plan,
  interval,
  currency,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlanResponse;
  interval: BillingInterval;
  currency: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const features = plan.modules && plan.modules.length > 0 ? plan.modules.slice(0, 4) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur-xl transition-colors ${
        selected
          ? 'border-blue-400/60 bg-blue-500/10 shadow-xl shadow-blue-500/20'
          : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-600'
      }`}
    >
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-500/30">
            <Sparkles className="h-3 w-3" /> Recommended
          </span>
        </div>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
        {plan.freeTrialDays > 0 && (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            {plan.freeTrialDays}-day trial
          </span>
        )}
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">{plan.description}</p>

      <div className="mb-4 flex items-end gap-1">
        <span className="text-3xl font-bold text-white">{formatPlanPrice(plan, interval, currency)}</span>
        <span className="pb-1 text-sm text-slate-400">/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-400" /> {formatUsers(plan.maxUsers)} users</span>
        <span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5 text-blue-400" /> {formatStorage(plan.maxStorage)}</span>
        <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-400" /> {plan.aiCredits > 0 ? `${plan.aiCredits.toLocaleString()} AI credits` : 'AI —'}</span>
        <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-emerald-400" /> {plan.reportsEnabled ? 'Advanced reports' : 'Basic reports'}</span>
      </div>

      <div className="mb-5 flex-1 space-y-2">
        {features.map((m) => (
          <li key={m} className="flex list-none items-center gap-2 text-xs text-slate-300">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> {moduleLabel(m)}
          </li>
        ))}
        {plan.apiAccess && (
          <li className="flex list-none items-center gap-2 text-xs text-slate-300">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> API access
          </li>
        )}
        {plan.prioritySupport && (
          <li className="flex list-none items-center gap-2 text-xs text-slate-300">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> Priority support
          </li>
        )}
      </div>

      <div className="mt-auto">
        <button
          onClick={onSelect}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${
            selected
              ? 'cursor-default border border-blue-400/60 bg-blue-600/80 text-white'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900'
          }`}
        >
          <Check className="h-4 w-4" /> {selected ? 'Selected' : 'Select Plan'}
        </button>
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
  const [allPlansOpen, setAllPlansOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const currency = useMemo(() => detectCurrency(session), [session]);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => getBillingPlans(),
    staleTime: 60_000,
  });

  const topPlans = useMemo(() => {
    if (!plans) return [];
    return plans
      .filter((p) => VISIBLE_PLAN_SLUGS.includes(p.slug))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
  }, [plans]);

  const selectedPlan = useMemo(
    () => plans?.find((p) => p.id === selected) ?? null,
    [plans, selected],
  );

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleSelect = (planId: string) => {
    setSelected(planId);
    setSelectionError(null);
    saveField('selectedPlanId', planId);
    saveField('planInterval', annual);
  };

  const handleContinue = async () => {
    if (!selected) {
      setSelectionError('Please select a plan to continue.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setSelectionError(null);
    try {
      saveField('selectedPlanId', selected);
      saveField('planInterval', annual);
      await persistSession();
      await completeStep(5);
      wizard.goNext();
    } finally {
      setSaving(false);
    }
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

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {topPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              interval={annual}
              currency={currency}
              selected={selected === plan.id}
              onSelect={() => handleSelect(plan.id)}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4">
          {selectedPlan && !topPlans.some((p) => p.id === selected) && (
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <Check className="h-4 w-4 text-emerald-400" />
              Selected plan: <span className="font-semibold text-white">{selectedPlan.name}</span>
            </p>
          )}
          <button
            onClick={() => setAllPlansOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <LayoutGrid className="h-4 w-4" /> See Other Plans
          </button>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex flex-col items-end gap-1.5">
            {selectionError && (
              <p className="text-xs text-amber-400">{selectionError}</p>
            )}
            <button
              onClick={handleContinue}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
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
    </motion.div>
  );
}
