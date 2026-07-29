'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';

export default function VerifyPage() {
  const { wizard, session, completeStep } = useOnboarding();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [timer]);

  if (!session) {
    return (
      <div className="flex items-center justify-center pt-20">
        <p className="text-slate-400">No session found.</p>
      </div>
    );
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) {
      const next = document.getElementById(`code-${index + 1}`);
      next?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backward-delete' || e.key === 'Backspace' || e.key === 'Delete') {
      if (!code[index] && index > 0) {
        const prev = document.getElementById(`code-${index - 1}`);
        prev?.focus();
      }
    }
  };

  const handleSubmit = async () => {
    const full = code.join('');
    if (full.length !== 6) {
      setLocalError('Please enter the full 6-digit code');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);
    await completeStep(2).then(() => {
      wizard.goNext();
    }).catch((e) => {
      setLocalError((e as Error).message ?? 'Verification failed');
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md pt-8"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
            <Mail className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Verify Your Email</h2>
            <p className="text-sm text-slate-400">
              We sent a code to <span className="text-white">{session.email}</span>
            </p>
          </div>
        </div>

        {localError && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{localError}</p>
        )}

        <div className="flex justify-center gap-3">
          {code.map((digit, i) => (
            <input
              key={i}
              id={`code-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-14 w-12 rounded-xl border border-slate-700 bg-slate-800/50 text-center text-xl font-bold text-white backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          ))}
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          {timer > 0 ? (
            <>Resend code in {timer}s</>
          ) : (
            <button
              onClick={() => { setTimer(60); setCode(['', '', '', '', '', '']); }}
              className="text-blue-400 hover:text-blue-300"
            >
              Resend code
            </button>
          )}
        </p>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={wizard.goBack}
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || code.join('').length !== 6}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verify
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
