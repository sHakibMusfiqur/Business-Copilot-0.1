'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CalendarClock, CreditCard, Loader2, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import {
  createCheckoutSession, getBillingPlans, getPaymentGateways, startFreeTrial, verifyPayment,
  type BillingSubscription, type SubscriptionPlanResponse,
} from '@/lib/api';
import { detectCurrency } from '@/lib/currency';
import { formatPlanPrice, type BillingInterval } from '../plan/plan-utils';

export default function PaymentPage() {
  const { wizard, session, saveField, completeStep, persistSession } = useOnboarding();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activated, setActivated] = useState<BillingSubscription | null>(null);
  const startingRef = useRef(false);

  const currency = session ? detectCurrency(session) : 'USD';

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

  const paymentEnabled = gateways?.some((g) => g.isEnabled) ?? false;

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const selectedPlanId = session.selectedPlanId;
  const interval = (session.planInterval as BillingInterval) ?? 'MONTHLY';
  const plan: SubscriptionPlanResponse | undefined = plans?.find((p) => p.id === selectedPlanId);

  const handleStartTrial = async () => {
    if (!plan || starting || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      saveField('selectedPlanId', plan.id);
      saveField('planInterval', interval);
      const subscription = await startFreeTrial(plan.id, interval);
      setActivated(subscription);
      await persistSession();
      await completeStep(6);
      wizard.goNext();
    } catch (e) {
      setError((e as Error).message ?? 'Could not start your free trial. Please try again.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handlePayNow = async () => {
    if (!plan || starting || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      saveField('selectedPlanId', plan.id);
      saveField('planInterval', interval);
      const checkout = await createCheckoutSession(plan.id, interval);
      window.location.assign(checkout.checkoutUrl);
    } catch (e) {
      setError((e as Error).message ?? 'Could not start secure checkout. Please try again or use the free trial.');
      startingRef.current = false;
      setStarting(false);
    }
  };

  // Handle the redirect back from the gateway (success or cancellation).
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const sessionStatus = params.get('session_status');
    const paymentId = params.get('payment_id');

    if (!paymentId || !sessionStatus) return;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('session_status');
      url.searchParams.delete('payment_id');
      window.history.replaceState({}, '', url.toString());
    };

    if (sessionStatus === 'cancelled') {
      setNotice('Payment was cancelled. You can try again or start your free trial instead.');
      cleanUrl();
      return;
    }

    if (sessionStatus === 'success') {
      setStarting(true);
      (async () => {
        try {
          const result = await verifyPayment(paymentId);
          // Only a backend-confirmed, succeeded payment may advance. If the
          // payment is still pending (webhook not yet delivered), hold the
          // user on this step rather than provisioning without a subscription.
          if (result.payment.status !== 'SUCCEEDED') {
            setNotice(
              result.payment.status === 'PENDING'
                ? 'Your payment is still being confirmed. It should activate within a few seconds.'
                : 'We could not confirm your payment. Please try again or start your free trial instead.',
            );
            setStarting(false);
            cleanUrl();
            return;
          }
          await persistSession();
          await completeStep(6);
          cleanUrl();
          wizard.goNext();
        } catch (e) {
          setError((e as Error).message ?? 'Payment could not be verified. Please try again.');
          setStarting(false);
          cleanUrl();
        }
      })();
    }
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!plan) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md pt-8 text-center">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
          <h2 className="mb-2 text-xl font-bold text-white">No plan selected</h2>
          <p className="mb-6 text-sm text-slate-400">Please choose a plan before continuing.</p>
          <button
            onClick={() => wizard.goTo(5)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Plans
          </button>
        </div>
      </motion.div>
    );
  }

  const trialLabel = `Start ${plan.freeTrialDays}-Day Free Trial`;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl pt-8">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <h2 className="mb-1 text-2xl font-bold text-white">Payment</h2>
        <p className="mb-6 text-sm text-slate-400">Complete your subscription setup</p>

        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{plan.name} plan</span>
              {plan.recommended && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">Recommended</span>
              )}
            </div>
            <span className="text-xs text-slate-400">{interval === 'YEARLY' ? 'Annual' : 'Monthly'}</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <span className="text-2xl font-bold text-white">{formatPlanPrice(plan, interval, currency)}</span>
              <span className="text-sm text-slate-400">/{interval === 'YEARLY' ? 'yr' : 'mo'}</span>
            </div>
            <span className="text-xs text-emerald-400">{currency}</span>
          </div>

          {plan.freeTrialDays > 0 && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" /> {plan.freeTrialDays}-day free trial included
            </div>
          )}

          {activated && activated.status === 'TRIALING' && activated.trialEndsAt && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-400">
              <CalendarClock className="h-3.5 w-3.5" />
              Trial active until {new Date(activated.trialEndsAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
        )}

        {notice && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{notice}</div>
        )}

        {paymentEnabled ? (
          <button
            onClick={handlePayNow}
            disabled={starting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CreditCard className="h-4 w-4" /> Pay Now
          </button>
        ) : (
          <button
            onClick={handleStartTrial}
            disabled={starting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-500 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {starting ? 'Starting your free trial…' : trialLabel}
          </button>
        )}

        {!paymentEnabled && (
          <p className="mt-3 text-center text-xs text-slate-500">
            No payment is required to start. You can add a payment method later from Billing.
          </p>
        )}

        {paymentEnabled && (
          <button
            onClick={handleStartTrial}
            disabled={starting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> Start free trial instead
          </button>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-700/50 pt-4">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Secure payment · encrypted
          </span>
        </div>
      </div>
    </motion.div>
  );
}
