'use client';

import { Check, Minus } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { SubscriptionPlanResponse } from '@/lib/api';

import { formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval } from './plan-utils';

function FeatureCell({ value, dark }: { value: boolean; dark: boolean }) {
  return (
    <div className="flex justify-center">
      {value ? <Check className="h-4 w-4 text-emerald-500" /> : <Minus className={`h-4 w-4 ${dark ? 'text-slate-500' : 'text-slate-300'}`} />}
    </div>
  );
}

export function ComparePlansDialog({
  plans,
  open,
  onClose,
  interval,
  currency,
  variant = 'light',
}: {
  plans: SubscriptionPlanResponse[];
  open: boolean;
  onClose: () => void;
  interval: BillingInterval;
  currency?: string;
  variant?: 'light' | 'dark';
}) {
  const dark = variant === 'dark';

  const label = dark ? 'text-slate-400' : 'text-slate-600';
  const value = dark ? 'text-slate-200' : 'text-slate-700';
  const heading = dark ? 'text-slate-400' : 'text-slate-500';
  const name = dark ? 'text-white' : 'text-slate-900';
  const price = dark ? 'text-slate-400' : 'text-slate-500';
  const divide = dark ? 'divide-slate-800' : 'divide-slate-100';
  const border = dark ? 'border-slate-700/60' : 'border-slate-200';

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent
        className={`max-h-[85vh] max-w-4xl overflow-y-auto ${dark ? 'border-slate-700/60 bg-slate-900/95 text-white backdrop-blur-2xl' : ''}`}
      >
        <DialogHeader>
          <DialogTitle>Compare Plans</DialogTitle>
          <DialogDescription>
            Compare features across all plans ({interval === 'YEARLY' ? 'Annual pricing' : 'Monthly pricing'})
            {currency ? ` · prices in ${currency}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className={`border-b ${border}`}>
                <th className={`py-3 pr-4 text-left font-semibold ${heading}`}>Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="px-3 py-3 text-center">
                    <div className={`font-semibold ${name}`}>{plan.name}</div>
                    <div className={`mt-1 text-xs font-normal ${price}`}>
                      {formatPlanPrice(plan, interval, currency)}
                      <span className={dark ? 'text-slate-500' : 'text-slate-400'}>/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
                    </div>
                    {plan.recommended && (
                      <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        dark ? 'border border-blue-500/40 bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                      }`}>
                        Recommended
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${divide}`}>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Free Trial</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {plan.freeTrialDays > 0 ? `${plan.freeTrialDays}-day` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Max Users</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {formatUsers(plan.maxUsers)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Storage</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {formatStorage(plan.maxStorage)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Max Customers</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {plan.maxCustomers >= 999999 ? 'Unlimited' : plan.maxCustomers.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Max Products</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {plan.maxProducts >= 999999 ? 'Unlimited' : plan.maxProducts.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>AI Credits / month</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {plan.aiCredits > 0 ? `${plan.aiCredits.toLocaleString()}` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Advanced Reports</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.reportsEnabled} dark={dark} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>API Access</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.apiAccess} dark={dark} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Priority Support</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.prioritySupport} dark={dark} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 ${label}`}>Custom Branding</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.customBranding} dark={dark} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 align-top ${label}`}>Integrations</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {plan.integrations && plan.integrations.length > 0
                      ? plan.integrations.join(', ')
                      : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 align-top ${label}`}>Security</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {plan.securityFeatures && plan.securityFeatures.length > 0
                      ? plan.securityFeatures.join(', ')
                      : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`py-2.5 pr-4 align-top ${label}`}>Modules</td>
                {plans.map((plan) => (
                  <td key={plan.id} className={`px-3 py-2.5 text-center ${value}`}>
                    {plan.modules && plan.modules.length > 0
                      ? plan.modules.map(moduleLabel).join(', ')
                      : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
