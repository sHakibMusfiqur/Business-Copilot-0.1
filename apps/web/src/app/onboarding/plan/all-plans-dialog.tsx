'use client';

import { motion } from 'framer-motion';
import { Check, HardDrive, Info, Layers, Shield, Sparkles, Users, Zap } from 'lucide-react';
import { useState } from 'react';

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { SubscriptionPlanResponse } from '@/lib/api';

import { formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval } from './plan-utils';
import { PlanDetailDialog } from './plan-detail-dialog';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function PlanCard({
  plan,
  interval,
  currency,
  selected,
  onSelect,
  onViewDetails,
}: {
  plan: SubscriptionPlanResponse;
  interval: BillingInterval;
  currency: string;
  selected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
}) {
  const features = plan.modules && plan.modules.length > 0 ? plan.modules.slice(0, 4) : [];

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
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
        <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-violet-400" /> {plan.reportsEnabled ? 'Advanced reports' : 'Basic reports'}</span>
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

      <div className="mt-auto flex flex-col gap-2">
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
        <button
          onClick={onViewDetails}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          <Info className="h-4 w-4" /> View Details
        </button>
      </div>
    </motion.div>
  );
}

export function AllPlansDialog({
  plans,
  open,
  onClose,
  interval,
  currency,
  selectedPlanId,
  onSelect,
}: {
  plans: SubscriptionPlanResponse[];
  open: boolean;
  onClose: () => void;
  interval: BillingInterval;
  currency: string;
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
}) {
  const [detailPlan, setDetailPlan] = useState<SubscriptionPlanResponse | null>(null);

  const handleSelect = (planId: string) => {
    onSelect(planId);
    setDetailPlan(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
        <DialogContent className="h-[92dvh] w-full max-w-none gap-0 overflow-y-auto border-slate-700/60 bg-slate-900/95 p-0 backdrop-blur-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-5xl sm:rounded-2xl sm:p-0">
          <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/90 px-6 py-5 backdrop-blur-xl sm:px-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white sm:text-2xl">Explore all plans</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-400">
                {interval === 'YEARLY' ? 'Annual pricing' : 'Monthly pricing'} · every plan includes a free trial
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                interval={interval}
                currency={currency}
                selected={selectedPlanId === plan.id}
                onSelect={() => handleSelect(plan.id)}
                onViewDetails={() => setDetailPlan(plan)}
              />
            ))}
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/90 px-6 py-4 backdrop-blur-xl sm:px-8">
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5" /> Prices shown in {currency}
            </span>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <PlanDetailDialog
        plan={detailPlan}
        open={detailPlan !== null}
        onClose={() => setDetailPlan(null)}
        onSelect={(planId) => handleSelect(planId)}
        currency={currency}
      />
    </>
  );
}
