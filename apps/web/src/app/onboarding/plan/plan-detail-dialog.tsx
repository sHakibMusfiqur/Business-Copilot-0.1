'use client';

import { Check, Layers, Shield, Plug } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { SubscriptionPlanResponse } from '@/lib/api';

import { formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval } from './plan-utils';

function Section({ icon: Icon, title, children }: {
  icon: typeof Check;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>
      {children}
    </div>
  );
}

export function PlanDetailDialog({
  plan,
  open,
  onClose,
  interval,
}: {
  plan: SubscriptionPlanResponse | null;
  open: boolean;
  onClose: () => void;
  interval: BillingInterval;
}) {
  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{plan.name} Plan</DialogTitle>
            {plan.recommended && <Badge variant="info">Recommended</Badge>}
          </div>
          <DialogDescription>{plan.description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-slate-900">
            {formatPlanPrice(plan, interval)}
          </span>
          <span className="pb-1 text-sm text-slate-500">/{interval === 'YEARLY' ? 'year' : 'month'}</span>
        </div>
        {plan.freeTrialDays > 0 && (
          <p className="text-sm text-emerald-600">Includes a {plan.freeTrialDays}-day free trial</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Section icon={Check} title="Limits">
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>Up to {formatUsers(plan.maxUsers)} users</li>
              <li>{formatStorage(plan.maxStorage)} storage</li>
              <li>{plan.maxCustomers >= 999999 ? 'Unlimited' : plan.maxCustomers.toLocaleString()} customers</li>
              <li>{plan.maxProducts >= 999999 ? 'Unlimited' : plan.maxProducts.toLocaleString()} products</li>
              {plan.aiCredits > 0 && <li>{plan.aiCredits.toLocaleString()} AI credits / month</li>}
            </ul>
          </Section>

          <Section icon={Layers} title="Capabilities">
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Check className={`h-3.5 w-3.5 ${plan.reportsEnabled ? 'text-emerald-500' : 'text-slate-300'}`} />
                Advanced Reports
              </li>
              <li className="flex items-center gap-2">
                <Check className={`h-3.5 w-3.5 ${plan.apiAccess ? 'text-emerald-500' : 'text-slate-300'}`} />
                API Access
              </li>
              <li className="flex items-center gap-2">
                <Check className={`h-3.5 w-3.5 ${plan.prioritySupport ? 'text-emerald-500' : 'text-slate-300'}`} />
                Priority Support
              </li>
              <li className="flex items-center gap-2">
                <Check className={`h-3.5 w-3.5 ${plan.customBranding ? 'text-emerald-500' : 'text-slate-300'}`} />
                Custom Branding
              </li>
            </ul>
          </Section>

          {plan.modules && plan.modules.length > 0 && (
            <Section icon={Layers} title="Modules">
              <div className="flex flex-wrap gap-1.5">
                {plan.modules.map((m) => (
                  <span key={m} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    {moduleLabel(m)}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {plan.integrations && plan.integrations.length > 0 && (
            <Section icon={Plug} title="Integrations">
              <div className="flex flex-wrap gap-1.5">
                {plan.integrations.map((i) => (
                  <span key={i} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                    {i}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {plan.securityFeatures && plan.securityFeatures.length > 0 && (
            <Section icon={Shield} title="Security">
              <div className="flex flex-wrap gap-1.5">
                {plan.securityFeatures.map((s) => (
                  <span key={s} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
