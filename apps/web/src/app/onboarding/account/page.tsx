'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { register as registerUser } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function AccountPage() {
  const { wizard, session, saveField, completeStep, persistSession, loading: sessionLoading } = useOnboarding();
  const { user: authUser, setUser } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="flex items-center justify-center pt-20">
        <p className="text-slate-400">No session found. Please start again.</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    const alreadyRegistered = authUser && authUser.email === session.email;
    if (!alreadyRegistered) {
      if (!password || password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        setLocalError('Password must contain uppercase, lowercase, and number');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
    }
    setLocalError(null);
    setIsSubmitting(true);
    try {
      if (alreadyRegistered) {
        saveField('userId', authUser.id);
      } else {
        const result = await registerUser(session.name, session.email, password);
        setUser(result.user, result.accessToken);
        saveField('userId', result.user.id);
      }
      await persistSession();
      await completeStep(1);
      wizard.goNext();
    } catch (e) {
      setLocalError((e as Error).message ?? 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md pt-8"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <h2 className="mb-2 text-2xl font-bold text-white">Create Your Account</h2>
        <p className="mb-6 text-sm text-slate-400">Set up your login credentials</p>

        {localError && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{localError}</p>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
            <User className="h-5 w-5 text-slate-500" />
            <span className="text-white">{session.name}</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
            <Mail className="h-5 w-5 text-slate-500" />
            <span className="text-white">{session.email}</span>
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-12 pr-12 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-12 pr-4 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={wizard.goBack}
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || sessionLoading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating account...' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
