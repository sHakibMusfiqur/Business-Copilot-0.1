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
      className={`relative flex flex-col rounded-2xl border p-5 transition-all ${isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-slate-300 dark:hover:border-white/[0.16]'}`}
    >
      {plan.recommended && !isCurrent && (
        <div className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-primary to-indigo-600 px-3 py-0.5 text-[10px] font-medium text-primary-foreground">
          Recommended
        </div>
      )}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
        {isCurrent && <Badge variant="success">Current</Badge>}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{plan.description}</p>
      <p className="mb-3">
        <span className="text-2xl font-bold text-foreground">{formatPlanPrice(plan, interval)}</span>
        <span className="text-sm text-muted-foreground">/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
      </p>
      <ul className="mb-4 flex-1 space-y-1.5 text-xs text-muted-foreground">
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
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
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
          <h1 className="text-2xl font-bold text-foreground">Billing &amp; Subscription</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your plan, trial and payment history</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/billing" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-slate-50 dark:hover:bg-white/[0.05]">
            <CreditCard className="h-4 w-4" /> Billing settings
          </Link>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {subscription && (
            <motion.div variants={itemVariants} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <h2 className="text-lg font-bold text-foreground">{subscription.plan.name} plan</h2>
                    <Badge variant={STATUS_VARIANT[subscription.status] ?? 'default'}>{statusLabel(subscription.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{currentPrice.toLocaleString()} {subscription.plan.currency}</span>
                    {' '}/ {subscription.billingInterval === 'YEARLY' ? 'year' : 'month'}
                    {' '}· renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {subscription.status === 'TRIALING' && (
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-700 dark:text-blue-400">
                        {subscription.trialDaysRemaining} trial {subscription.trialDaysRemaining === 1 ? 'day' : 'days'} left
                      </span>
                    </div>
                  )}
                  {subscription.trialEndsAt && (
                    <p className="mt-1 text-xs text-muted-foreground">Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {!subscription && (
            <motion.div variants={itemVariants} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-500/20 dark:bg-blue-500/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
                    <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">No active subscription yet</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Pick a plan below to start your free trial — no card required.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Plans</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${interval === 'MONTHLY' ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
                <button
                  onClick={() => setInterval(interval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
                  className={`relative h-5 w-9 rounded-full transition-colors ${interval === 'YEARLY' ? 'bg-primary' : 'bg-slate-300 dark:bg-white/[0.2]'}`}
                  aria-label="Toggle annual billing"
                >
                  <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${interval === 'YEARLY' ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className={`text-xs font-medium ${interval === 'YEARLY' ? 'text-foreground' : 'text-muted-foreground'}`}>Annual</span>
              </div>
              <button
                onClick={() => setCompareOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-slate-50 dark:hover:bg-white/[0.05]"
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
            <motion.div variants={itemVariants} className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
              </div>
              <div className="p-5">
                {paymentsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : paymentsQuery.data && paymentsQuery.data.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {paymentsQuery.data.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.plan?.name ?? 'Payment'}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.gateway ? p.gateway : 'Manual'} · {new Date(p.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-foreground">
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

            <motion.div variants={itemVariants} className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
              </div>
              <div className="p-5">
                {invoicesQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {invoicesQuery.data.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">Issued {new Date(inv.issuedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-foreground">
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

          <motion.div variants={itemVariants} className="rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <RefreshCcw className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Payment Methods</h2>
                <p className="text-xs text-muted-foreground">Gateways coming soon</p>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {(gatewaysQuery.data ?? []).map((g) => (
                <div key={g.id} className="rounded-xl border border-border bg-slate-50/60 p-4 dark:bg-white/[0.03]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{g.name}</span>
                    <Badge variant={g.isEnabled ? 'success' : 'default'}>{g.isEnabled ? 'Enabled' : 'Coming soon'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{g.code}</p>
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
