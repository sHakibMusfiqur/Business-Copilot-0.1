'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Starter', slug: 'starter',
    description: 'For small businesses just getting started',
    price: 29, currency: 'USD', interval: 'month',
    features: ['Up to 5 users', 'Core modules', 'Basic reporting', 'Email support'],
  },
  {
    id: 'growth', name: 'Growth', slug: 'growth',
    description: 'For growing teams with advanced needs',
    price: 79, currency: 'USD', interval: 'month',
    features: ['Up to 25 users', 'All modules', 'Advanced reporting', 'Priority support', 'API access'],
  },
  {
    id: 'enterprise', name: 'Enterprise', slug: 'enterprise',
    description: 'For large organizations with custom requirements',
    price: 199, currency: 'USD', interval: 'month',
    features: ['Unlimited users', 'All modules + custom', 'Custom reporting', 'Dedicated support', 'API + SSO', 'SLA guarantee'],
  },
];

export default function PlanPage() {
  const { wizard, session, saveField, completeStep, persistSession } = useOnboarding();
  const [selected, setSelected] = useState(session?.selectedPlanId ?? 'growth');
  const [annual, setAnnual] = useState(false);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const getPrice = (plan: Plan) => annual ? plan.price * 10 : plan.price;
  const selectedPlan = PLANS.find((p) => p.id === selected);

  const handleContinue = async () => {
    saveField('selectedPlanId', selected);
    await persistSession();
    await completeStep(5);
    wizard.goNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl pt-8"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <h2 className="mb-2 text-2xl font-bold text-white">Choose Your Plan</h2>
        <p className="mb-6 text-sm text-slate-400">Pick the plan that fits your business</p>

        <div className="mb-6 flex items-center justify-center gap-3">
          <span className={`text-sm ${!annual ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative h-6 w-11 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm ${annual ? 'text-white' : 'text-slate-400'}`}>
            Annual <span className="text-green-400">(2 months free)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={`group relative rounded-xl border p-6 text-left transition-all ${
                selected === plan.id
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              }`}
            >
              {plan.id === 'growth' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-0.5 text-xs font-medium text-white">
                  Popular
                </div>
              )}
              <h3 className="mb-1 text-lg font-bold text-white">{plan.name}</h3>
              <p className="mb-4 text-xs text-slate-400">{plan.description}</p>
              <p className="mb-4">
                <span className="text-3xl font-bold text-white">${getPrice(plan)}</span>
                <span className="text-sm text-slate-400">/{annual ? 'yr' : 'mo'}</span>
              </p>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="h-3.5 w-3.5 text-green-400" /> {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {selectedPlan && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-center text-sm text-slate-400"
          >
            {selectedPlan.name} plan &mdash; ${getPrice(selectedPlan)}/{annual ? 'year' : 'month'}
          </motion.p>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={handleContinue} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
