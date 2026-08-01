'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Check, CreditCard, FileText, Layers, Loader2, RefreshCcw, Sparkles, Timer,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  changeSubscriptionPlan, getBillingInvoices, getBillingPlans, getPaymentHistory, getPaymentGateways,
  getSubscription, type BillingInterval, type SubscriptionPlanResponse,
} from '@/lib/api';
import { ComparePlansDialog } from '@/app/onboarding/plan/compare-plans-dialog';
import {
  formatPlanPrice, formatStorage, formatUsers, moduleLabel, type BillingInterval as PlanInterval,
} from '@/app/onboarding/plan/plan-utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'info' | 'destructive'> = {
  TRIALING: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELLED: 'destructive',
  EXPIRED: 'destructive',
};

const PAYMENT_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'info' | 'destructive'> = {
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'destructive',
  REFUNDED: 'info',
  CANCELLED: 'destructive',
};

const INVOICE_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'info' | 'destructive'> = {
  DRAFT: 'default',
  ISSUED: 'info',
  PAID: 'success',
  OVERDUE: 'destructive',
  VOID: 'default',
};

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

function PlanCard({
  plan, current, interval, currentPrice, onSelect, changing,
}: {
  plan: SubscriptionPlanResponse;
  current: boolean;
  interval: BillingInterval;
  currentPrice: number;
  onSelect: () => void;
  changing: boolean;
}) {
  const isCurrent = current && plan.interval === interval;
  const planPrice = interval === 'YEARLY' ? (plan.yearlyPrice ?? plan.price * 10) : plan.price;
  const actionLabel = planPrice > currentPrice ? 'Upgrade' : planPrice < currentPrice ? 'Downgrade' : 'Switch';
  return (
    <motion.div
      variants={itemVariants}
      className={`relative flex flex-col rounded-2xl border p-5 transition-all ${isCurrent ? 'border-primary bg-primary/5' : 'border-slate-200/70 bg-white hover:border-slate-300'}`}
    >
      {plan.recommended && !isCurrent && (
        <div className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-0.5 text-[10px] font-medium text-white">
          Recommended
        </div>
      )}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
        {isCurrent && <Badge variant="success">Current</Badge>}
      </div>
      <p className="mb-3 text-xs text-slate-500">{plan.description}</p>
      <p className="mb-3">
        <span className="text-2xl font-bold text-slate-900">{formatPlanPrice(plan, interval)}</span>
        <span className="text-sm text-slate-400">/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
      </p>
      <ul className="mb-4 flex-1 space-y-1.5 text-xs text-slate-600">
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Up to {formatUsers(plan.maxUsers)} users</li>
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> {formatStorage(plan.maxStorage)} storage</li>
        {plan.reportsEnabled && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Advanced reports</li>}
        {plan.apiAccess && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> API access</li>}
        {plan.prioritySupport && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Priority support</li>}
        {(plan.modules ?? []).slice(0, 2).map((m) => (
          <li key={m} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> {moduleLabel(m)}</li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={isCurrent || changing}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:cursor-default ${
          isCurrent
            ? 'bg-slate-100 text-slate-400'
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        {changing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isCurrent ? 'Current plan' : actionLabel}
      </button>
    </motion.div>
  );
}

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [interval, setInterval] = useState<BillingInterval>('MONTHLY');
  const [compareOpen, setCompareOpen] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  const subscriptionQuery = useQuery({ queryKey: ['billing', 'subscription'], queryFn: () => getSubscription(), staleTime: 30_000 });
  const plansQuery = useQuery({ queryKey: ['billing', 'plans'], queryFn: () => getBillingPlans(), staleTime: 60_000 });
  const paymentsQuery = useQuery({ queryKey: ['billing', 'payments'], queryFn: () => getPaymentHistory(), staleTime: 60_000 });
  const invoicesQuery = useQuery({ queryKey: ['billing', 'invoices'], queryFn: () => getBillingInvoices(), staleTime: 60_000 });
  const gatewaysQuery = useQuery({ queryKey: ['billing', 'gateways'], queryFn: () => getPaymentGateways(), staleTime: 60_000 });

  const changePlanMutation = useMutation({
    mutationFn: ({ planId, billingInterval }: { planId: string; billingInterval: BillingInterval }) =>
      changeSubscriptionPlan(planId, billingInterval),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      await queryClient.invalidateQueries({ queryKey: ['billing', 'payments'] });
      toast({
        title: 'Plan updated',
        description: `Your workspace is now on the ${updated.plan.name} plan.`,
        variant: 'success',
      });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Could not change plan',
        description: err instanceof Error ? err.message : 'Something went wrong while updating your plan.',
        variant: 'destructive',
      });
    },
  });

  const subscription = subscriptionQuery.data;
  const plans = plansQuery.data ?? [];

  const currentPrice = useMemo(() => {
    if (!subscription) return 0;
    return subscription.billingInterval === 'YEARLY'
      ? (subscription.plan.yearlyPrice ?? subscription.plan.price * 10)
      : subscription.plan.price;
  }, [subscription]);

  const handleChange = (planId: string) => {
    setChangingId(planId);
    changePlanMutation.mutate(
      { planId, billingInterval: interval },
      { onSettled: () => setChangingId(null) },
    );
  };

  const loading = subscriptionQuery.isLoading || plansQuery.isLoading;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing &amp; Subscription</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your plan, trial and payment history</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/billing" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <CreditCard className="h-4 w-4" /> Billing settings
          </Link>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {subscription && (
            <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200/70 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900">{subscription.plan.name} plan</h2>
                    <Badge variant={STATUS_VARIANT[subscription.status] ?? 'default'}>{statusLabel(subscription.status)}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-900">{currentPrice.toLocaleString()} {subscription.plan.currency}</span>
                    {' '}/ {subscription.billingInterval === 'YEARLY' ? 'year' : 'month'}
                    {' '}· renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {subscription.status === 'TRIALING' && (
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-700">
                        {subscription.trialDaysRemaining} trial {subscription.trialDaysRemaining === 1 ? 'day' : 'days'} left
                      </span>
                    </div>
                  )}
                  {subscription.trialEndsAt && (
                    <p className="mt-1 text-xs text-slate-400">Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {!subscription && (
            <motion.div variants={itemVariants} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">No active subscription yet</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Pick a plan below to start your free trial — no card required.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Plans</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${interval === 'MONTHLY' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                <button
                  onClick={() => setInterval(interval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
                  className={`relative h-5 w-9 rounded-full transition-colors ${interval === 'YEARLY' ? 'bg-primary' : 'bg-slate-300'}`}
                  aria-label="Toggle annual billing"
                >
                  <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${interval === 'YEARLY' ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className={`text-xs font-medium ${interval === 'YEARLY' ? 'text-slate-900' : 'text-slate-400'}`}>Annual</span>
              </div>
              <button
                onClick={() => setCompareOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Layers className="h-3.5 w-3.5" /> Compare plans
              </button>
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={subscription?.planId === plan.id}
                interval={interval}
                currentPrice={currentPrice}
                onSelect={() => handleChange(plan.id)}
                changing={changingId === plan.id}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200/70 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <CreditCard className="h-4 w-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Payment History</h2>
              </div>
              <div className="p-5">
                {paymentsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                ) : paymentsQuery.data && paymentsQuery.data.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {paymentsQuery.data.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.plan?.name ?? 'Payment'}</p>
                          <p className="text-xs text-slate-400">
                            {p.gateway ? p.gateway : 'Manual'} · {new Date(p.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-900">
                            {p.currency === 'USD' ? '$' : ''}{p.amount.toLocaleString()} {p.currency !== 'USD' ? p.currency : ''}
                          </span>
                          <Badge variant={PAYMENT_STATUS_VARIANT[p.status] ?? 'default'}>{statusLabel(p.status)}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={CreditCard}
                    title="No payments yet"
                    description="Payments will appear here once a gateway is connected."
                  />
                )}
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200/70 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <FileText className="h-4 w-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
              </div>
              <div className="p-5">
                {invoicesQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {invoicesQuery.data.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{inv.invoiceNumber}</p>
                          <p className="text-xs text-slate-400">Issued {new Date(inv.issuedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-900">
                            {inv.currency === 'USD' ? '$' : ''}{inv.amount.toLocaleString()} {inv.currency !== 'USD' ? inv.currency : ''}
                          </span>
                          <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? 'default'}>{statusLabel(inv.status)}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No invoices yet"
                    description="Invoices are generated once a payment is processed."
                  />
                )}
              </div>
            </motion.div>
          </div>

          <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200/70 bg-white">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                <RefreshCcw className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Payment Methods</h2>
                <p className="text-xs text-slate-400">Gateways coming soon</p>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {(gatewaysQuery.data ?? []).map((g) => (
                <div key={g.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{g.name}</span>
                    <Badge variant={g.isEnabled ? 'success' : 'default'}>{g.isEnabled ? 'Enabled' : 'Coming soon'}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">{g.code}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      <ComparePlansDialog
        plans={plans}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        interval={interval as unknown as PlanInterval}
      />
    </motion.div>
  );
}
