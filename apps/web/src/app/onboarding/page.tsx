'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from './_hooks/onboarding-context';

export default function WelcomePage() {
  const { wizard, initSession, loading } = useOnboarding();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!email.trim() || !name.trim()) {
      setLocalError('Please enter your name and email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Invalid email address');
      return;
    }
    setLocalError(null);
    const session = await initSession(email.trim(), name.trim());
    if (session) {
      wizard.goTo(1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center pt-16 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl"
      >
        <Sparkles className="h-10 w-10 text-white" />
      </motion.div>

      <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">
        Welcome to Business Copilot
      </h1>
      <p className="mb-10 max-w-md text-lg text-slate-400">
        Let&apos;s get your business set up. We&apos;ll guide you through
        configuring your organization, team, and modules.
      </p>

      {localError && (
        <p className="mb-4 text-sm text-red-400">{localError}</p>
      )}

      <div className="w-full max-w-sm space-y-4">
        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <button
          onClick={handleStart}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Creating session...' : 'Get Started'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
