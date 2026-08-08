'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';

import { forgotPassword } from '@/lib/api';
import { EMAIL_RE } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const value = email.trim();
      if (!EMAIL_RE.test(value)) {
        setEmailError('Enter a valid email address');
        return;
      }
      setEmailError(null);
      setError(null);
      setIsSubmitting(true);
      try {
        await forgotPassword(value);
        setSent(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [email],
  );

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
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent
                ? 'Check your inbox'
                : 'Enter your email and we’ll send you a secure link to reset your password.'}
            </p>
          </div>

          {sent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  If an account exists for <strong>{email.trim()}</strong>, a reset link is on its
                  way. Follow it to choose a new password. If you don&apos;t see it, check your
                  spam folder.
                </p>
              </div>
              <Link
                href="/login"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="you@example.com"
                  />
                </div>
                {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 animate-pulse" /> Sending...
                  </span>
                ) : (
                  'Send reset link'
                )}
              </button>

              <p className="pt-2 text-center text-sm text-muted-foreground">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-primary/80"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}