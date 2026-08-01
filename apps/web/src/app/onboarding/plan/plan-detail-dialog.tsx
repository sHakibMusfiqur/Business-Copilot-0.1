'use client';

import { motion } from 'framer-motion';
import { Check, Layers, Plug, Shield, Sparkles, Users, HardDrive, Zap, BarChart3, Globe } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { SubscriptionPlanResponse } from '@/lib/api';

import {
  featureLabel, formatPlanPrice, formatStorage, formatUsers, moduleLabel,
} from './plan-utils';

function Section({ icon: Icon, title, children }: {
  icon: typeof Check;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-400" />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function FeatureLine({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-slate-300">
      <Check className={`h-3.5 w-3.5 shrink-0 ${enabled ? 'text-emerald-400' : 'text-slate-600'}`} />
      <span className={enabled ? '' : 'text-slate-500'}>{label}</span>
    </li>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-full border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-200 ${className ?? ''}`}>
      {children}
    </span>
  );
}

export function PlanDetailDialog({
  plan,
  open,
  onClose,
  onSelect,
  currency,
}: {
  plan: SubscriptionPlanResponse | null;
  open: boolean;
  onClose: () => void;
  onSelect?: (planId: string) => void;
  currency: string;
}) {
  if (!plan) return null;

  const featureEntries = plan.features
    ? Object.entries(plan.features).filter(([, enabled]) => enabled)
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="h-[92dvh] w-full max-w-none gap-0 overflow-y-auto border-slate-700/60 bg-slate-900/95 p-0 backdrop-blur-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="border-b border-slate-800 px-6 py-5 sm:px-8">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold text-white sm:text-2xl">{plan.name} Plan</DialogTitle>
                {plan.recommended && <Badge variant="info">Recommended</Badge>}
                {plan.freeTrialDays > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <Sparkles className="h-3 w-3" /> {plan.freeTrialDays}-day free trial
                  </span>
                )}
              </div>
              <DialogDescription className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {plan.description}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Monthly</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {formatPlanPrice(plan, 'MONTHLY', currency)}
                  <span className="text-sm font-normal text-slate-400">/mo</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Yearly</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {formatPlanPrice(plan, 'YEARLY', currency)}
                  <span className="text-sm font-normal text-slate-400">/yr</span>
                </p>
                <p className="mt-1 text-[10px] text-emerald-400">Save ~2 months</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 sm:px-8">
            <Section icon={Users} title="Plan Limits">
              <ul className="space-y-1.5 text-sm text-slate-300">
                <li>Up to {formatUsers(plan.maxUsers)} users</li>
                <li className="flex items-center gap-2"><HardDrive className="h-3.5 w-3.5 text-slate-500" /> {formatStorage(plan.maxStorage)} storage</li>
                <li>{plan.maxCustomers >= 999999 ? 'Unlimited' : plan.maxCustomers.toLocaleString()} customers</li>
                <li>{plan.maxProducts >= 999999 ? 'Unlimited' : plan.maxProducts.toLocaleString()} products</li>
              </ul>
            </Section>

            <Section icon={Zap} title="AI Capabilities">
              <ul className="space-y-1.5 text-sm text-slate-300">
                <li>
                  {plan.aiCredits > 0
                    ? `${plan.aiCredits.toLocaleString()} AI credits / month`
                    : 'No AI credits included'}
                </li>
                <li className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-slate-500" /> AI business copilot assistant</li>
              </ul>
            </Section>

            <Section icon={BarChart3} title="Reports & Access">
              <ul className="space-y-1.5">
                <FeatureLine enabled={plan.reportsEnabled} label="Advanced reports" />
                <FeatureLine enabled={plan.apiAccess} label="API access" />
                <FeatureLine enabled={plan.prioritySupport} label="Priority support" />
                <FeatureLine enabled={plan.customBranding} label="Custom branding" />
              </ul>
            </Section>

            <Section icon={Globe} title="Support Level">
              <ul className="space-y-1.5">
                <FeatureLine enabled={plan.prioritySupport} label="Priority support" />
                <FeatureLine enabled={plan.customBranding} label="Custom branding" />
                <FeatureLine enabled={!plan.prioritySupport} label="Standard email support" />
              </ul>
            </Section>

            {plan.modules && plan.modules.length > 0 && (
              <Section icon={Layers} title="Modules Included">
                <div className="flex flex-wrap gap-1.5">
                  {plan.modules.map((m) => (
                    <Chip key={m}>{moduleLabel(m)}</Chip>
                  ))}
                </div>
              </Section>
            )}

            {plan.integrations && plan.integrations.length > 0 && (
              <Section icon={Plug} title="Integrations">
                <div className="flex flex-wrap gap-1.5">
                  {plan.integrations.map((i) => (
                    <Chip key={i} className="border-blue-700/50 bg-blue-500/10 text-blue-200">{i}</Chip>
                  ))}
                </div>
              </Section>
            )}

            {plan.securityFeatures && plan.securityFeatures.length > 0 && (
              <Section icon={Shield} title="Security">
                <div className="flex flex-wrap gap-1.5">
                  {plan.securityFeatures.map((s) => (
                    <Chip key={s} className="border-emerald-700/50 bg-emerald-500/10 text-emerald-200">{s}</Chip>
                  ))}
                </div>
              </Section>
            )}

            {featureEntries.length > 0 && (
              <Section icon={Check} title="Complete Feature List">
                <div className="flex flex-wrap gap-1.5">
                  {featureEntries.map(([key]) => (
                    <Chip key={key}>{featureLabel(key)}</Chip>
                  ))}
                </div>
              </Section>
            )}
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/90 px-6 py-4 backdrop-blur-xl sm:px-8">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Back
            </button>
            {onSelect && (
              <button
                onClick={() => onSelect(plan.id)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                <Check className="h-4 w-4" /> Select This Plan
              </button>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
