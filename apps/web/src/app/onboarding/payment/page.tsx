'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, CreditCard, Loader2, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import {
  createCheckoutSession, getBillingPlans, getPaymentGateways, verifyPayment,
  type SubscriptionPlanResponse,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { detectCurrency } from '@/lib/currency';
import { formatPlanPrice, type BillingInterval } from '../plan/plan-utils';

type PaymentOption = 'payNow' | 'trial';

export default function PaymentPage() {
  const { wizard, session, saveField, completeStep, persistSession } = useOnboarding();
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const startingRef = useRef(false);

  const user = useAuthStore((s) => s.user);

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

  // A gateway must be enabled in the DB *and* configured (has credentials) to
  // actually process a real payment. An enabled-but-not-configured gateway (e.g.
  // Stripe enabled but STRIPE_SECRET_KEY unset) cannot charge, so paid checkout
  // stays unavailable and the UI explains why.
  const paymentAvailable = gateways?.some((g) => g.isEnabled && g.configured) ?? false;

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

  const handleContinue = async () => {
    if (!plan || starting || startingRef.current || selectedOption === null) return;
    if (selectedOption === 'payNow') {
      if (!paymentAvailable) return;
      await handlePayNow();
    } else {
      await handleStartTrial();
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
          const result = await verifyPayment(paymentId, params.get('val_id') ?? undefined);
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

  const trialDays = plan.freeTrialDays ?? 30;
  const priceLabel = formatPlanPrice(plan, interval, currency);
  const priceUnit = interval === 'YEARLY' ? '/yr' : '/mo';
  const subscriptionLabel = interval === 'YEARLY' ? 'Annual subscription' : 'Monthly subscription';
  const payNowDisabled = !paymentAvailable || !user?.organizationId;

  const optionCardClass = (selected: boolean, disabled = false) =>
    `group relative flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
      disabled
        ? 'cursor-not-allowed border-slate-700/50 bg-slate-800/20 opacity-50'
        : selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
    }`;

  const optionDotClass = (selected: boolean) =>
    `mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
      selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-500 text-transparent'
    }`;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl pt-8">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <h2 className="mb-1 text-2xl font-bold text-white">Payment</h2>
        <p className="mb-6 text-sm text-slate-400">Choose how you would like to start — no charges until you decide.</p>

        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
          <span className="text-sm font-semibold text-white">{plan.name} plan</span>
          <span className="text-xs text-slate-400">{interval === 'YEARLY' ? 'Annual billing' : 'Monthly billing'}</span>
        </div>

        <div role="radiogroup" aria-label="Payment options" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Option A — Pay Now */}
          <button
            type="button"
            role="radio"
            aria-checked={selectedOption === 'payNow'}
            disabled={payNowDisabled}
            onClick={() => setSelectedOption('payNow')}
            className={optionCardClass(selectedOption === 'payNow', payNowDisabled)}
          >
            <span className={optionDotClass(selectedOption === 'payNow')}>
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <CreditCard className="h-4 w-4 text-blue-400" /> Pay Now
                </span>
                {plan.recommended && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">Recommended</span>
                )}
              </span>
              <span className="text-xs text-slate-400">{subscriptionLabel}</span>
              <span className="mt-1 flex items-baseline gap-0.5">
                <span className="text-xl font-bold text-white">{priceLabel}</span>
                <span className="text-xs text-slate-400">{priceUnit}</span>
              </span>
              {plan.recommended && (
                <span className="text-[11px] font-medium text-blue-300">Recommended for production</span>
              )}
            </span>
          </button>

          {/* Option B — Free Trial */}
          <button
            type="button"
            role="radio"
            aria-checked={selectedOption === 'trial'}
            onClick={() => setSelectedOption('trial')}
            className={optionCardClass(selectedOption === 'trial')}
          >
            <span className={optionDotClass(selectedOption === 'trial')}>
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> Start Free Trial
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  {trialDays} days free
                </span>
              </span>
              <span className="text-xs text-slate-400">{trialDays}-day free trial · full access</span>
              <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white">
                <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} /> No charge today
              </span>
            </span>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
        )}

        {notice && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{notice}</div>
        )}

        <button
          onClick={handleContinue}
          disabled={starting || selectedOption === null || (selectedOption === 'payNow' && payNowDisabled)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {starting ? 'Processing…' : 'Continue'}
        </button>

        {!paymentAvailable && (
          <p className="mt-3 text-center text-xs text-slate-400">
            <span className="font-medium text-slate-300">Pay Now is unavailable</span> because no payment
            gateway is currently configured. Configure Stripe to enable paid checkout, or start your free
            trial now and add a payment method later from Billing.
          </p>
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
