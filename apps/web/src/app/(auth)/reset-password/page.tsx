'use client';

import { Suspense, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { resetPassword } from '@/lib/api';

const MIN_PASSWORD = 8;

const PASSWORD_RE = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);
      setError(null);
      if (password.length < MIN_PASSWORD) {
        setPasswordError(`Password must be at least ${MIN_PASSWORD} characters.`);
        return;
      }
      if (!PASSWORD_RE.test(password)) {
        setPasswordError('Password must contain an uppercase letter, a lowercase letter, and a number.');
        return;
      }
      if (password !== confirm) {
        setPasswordError('Passwords do not match.');
        return;
      }
      if (!token) {
        setError('This reset link is missing a token. Please request a new one.');
        return;
      }
      setIsSubmitting(true);
      try {
        await resetPassword(token, password);
        setDone(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not reset your password. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, confirm, token],
  );

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Your password has been reset. You can now sign in with your new password.</p>
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-10 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-2 block text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-input bg-background/50 py-2.5 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Re-enter your new password"
          />
          {passwordError && <p className="mt-1 text-xs text-destructive">{passwordError}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="m-auto w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-2xl p-8"
        >
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold">Choose a new password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter and confirm your new password to finish resetting.
            </p>
          </div>
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
}