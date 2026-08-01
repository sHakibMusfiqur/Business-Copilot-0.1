'use client';

import { Check, Minus } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { SubscriptionPlanResponse } from '@/lib/api';

import { formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval } from './plan-utils';

function FeatureCell({ value }: { value: boolean }) {
  return (
    <div className="flex justify-center">
      {value ? <Check className="h-4 w-4 text-emerald-500" /> : <Minus className="h-4 w-4 text-slate-300" />}
    </div>
  );
}

export function ComparePlansDialog({
  plans,
  open,
  onClose,
  interval,
}: {
  plans: SubscriptionPlanResponse[];
  open: boolean;
  onClose: () => void;
  interval: BillingInterval;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Plans</DialogTitle>
          <DialogDescription>
            Compare features across all plans ({interval === 'YEARLY' ? 'Annual pricing' : 'Monthly pricing'})
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4 text-left font-semibold text-slate-500">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="px-3 py-3 text-center">
                    <div className="font-semibold text-slate-900">{plan.name}</div>
                    <div className="mt-1 text-xs font-normal text-slate-500">
                      {formatPlanPrice(plan, interval)}
                      <span className="text-slate-400">/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
                    </div>
                    {plan.recommended && (
                      <div className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        Recommended
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Free Trial</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {plan.freeTrialDays > 0 ? `${plan.freeTrialDays}-day` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Max Users</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {formatUsers(plan.maxUsers)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Storage</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {formatStorage(plan.maxStorage)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Max Customers</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {plan.maxCustomers >= 999999 ? 'Unlimited' : plan.maxCustomers.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Max Products</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {plan.maxProducts >= 999999 ? 'Unlimited' : plan.maxProducts.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">AI Credits / month</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {plan.aiCredits > 0 ? `${plan.aiCredits.toLocaleString()}` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Advanced Reports</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.reportsEnabled} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">API Access</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.apiAccess} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Priority Support</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.prioritySupport} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-slate-600">Custom Branding</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5">
                    <FeatureCell value={plan.customBranding} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 align-top text-slate-600">Integrations</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {plan.integrations && plan.integrations.length > 0
                      ? plan.integrations.join(', ')
                      : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 align-top text-slate-600">Security</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
                    {plan.securityFeatures && plan.securityFeatures.length > 0
                      ? plan.securityFeatures.join(', ')
                      : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 align-top text-slate-600">Modules</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-3 py-2.5 text-center text-slate-700">
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
