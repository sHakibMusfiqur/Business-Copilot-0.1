'use client';

import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, ArrowRight, PartyPopper } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { refreshAccessToken } from '@/lib/api';
import {
  getSession, provisionOrganization, createProvisioningEventSource,
  type ProvisioningProgress,
} from '@/lib/onboarding-api';

export default function ProvisioningPage() {
  const { wizard, session, completeStep, persistSession } = useOnboarding();
  const [progress, setProgress] = useState<ProvisioningProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const provisionStartedRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);

  const traceRef = useRef(0);

  useEffect(() => {
    const traceId = ++traceRef.current;
    console.log(`[PROVISION EFFECT ${traceId}] FIRED`, {
      session: session ? { selectedIndustry: session.selectedIndustry, orgName: session.orgName, version: session.version, currentStep: session.currentStep, completedSteps: session.completedSteps, provisionStatus: session.provisionStatus } : null,
      retryCount,
      provisionStartedRef: provisionStartedRef.current,
    });
    if (!session) return;
    if (provisionStartedRef.current) return;

    if (session.provisionStatus === 'COMPLETED') {
      refreshAccessToken();
      setDone(true);
      return;
    }

    if (session.provisionStatus === 'FAILED' && retryCount === 0) {
      setError('Previous provisioning failed. Retry to resume.');
      return;
    }

    provisionStartedRef.current = true;

    const startProvision = async () => {
      setStarting(true);
      try {
        console.log(`[PROVISION ${traceId}] about to call persistSession, session values:`, { selectedIndustry: session.selectedIndustry, orgName: session.orgName, version: session.version });
        const persisted = await persistSession();
        console.log(`[PROVISION ${traceId}] after persistSession, persisted =`, { selectedIndustry: persisted?.selectedIndustry, orgName: persisted?.orgName, version: persisted?.version });
        const latestSession = await getSession(session.id).catch(() => persisted ?? session);
        console.log(`[PROVISION ${traceId}] after getSession, latestSession =`, { selectedIndustry: latestSession?.selectedIndustry, orgName: latestSession?.orgName, version: latestSession?.version });
        const sessionData = latestSession ?? persisted ?? session;
        console.log(`[PROVISION ${traceId}] resolved sessionData =`, { selectedIndustry: sessionData?.selectedIndustry, orgName: sessionData?.orgName, version: sessionData?.version });
        console.log(`[PROVISION ${traceId}] validation check: selectedIndustry=${sessionData?.selectedIndustry}, orgName=${sessionData?.orgName}`);
        if (!sessionData.selectedIndustry || !sessionData.orgName) {
          provisionStartedRef.current = false;
          setStarting(false);
          console.log(`[PROVISION ${traceId}] VALIDATION FAILED: selectedIndustry=${sessionData.selectedIndustry}, orgName=${sessionData.orgName}`);
          setError('Missing required onboarding data. Redirecting to the step that still needs input.');
          wizard.goTo(!sessionData.selectedIndustry ? 1 : 2);
          return;
        }
        console.log(`[PROVISION ${traceId}] VALIDATION PASSED, calling provisionOrganization`, { selectedIndustry: sessionData.selectedIndustry, orgName: sessionData.orgName });
        await provisionOrganization(session.id, {
          selectedIndustry: sessionData.selectedIndustry,
          orgName: sessionData.orgName,
        });
      } catch (e) {
        provisionStartedRef.current = false;
        setError((e as Error).message ?? 'Provisioning failed to start');
        setStarting(false);
        return;
      }
      setStarting(false);

      const es = createProvisioningEventSource(session.id);
      esRef.current = es;

      es.addEventListener('provisioning', (event) => {
        try {
          const data = JSON.parse(event.data);
          setProgress((prev) => ({
            sessionId: session.id,
            status: 'PROVISIONING',
            progress: data.progress ?? prev?.progress ?? 0,
            currentTask: data.currentTask ?? prev?.currentTask ?? null,
            completedTasks: data.completedTasks ?? prev?.completedTasks ?? [],
            failedTask: data.failedTask ?? null,
            error: null,
          }));
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        es.close();
      };
    };

    startProvision();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [session, retryCount]);

  useEffect(() => {
    if (!done && progress?.status === 'COMPLETED') {
      (async () => {
        await completeStep(6);
        await refreshAccessToken();
        setDone(true);
      })();
    }
  }, [progress?.status]);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-md pt-8 text-center"
      >
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 backdrop-blur-xl">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <PartyPopper className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Provisioning Complete!</h2>
          <p className="mb-6 text-sm text-slate-400">Your organization is ready. Let&apos;s finish setup.</p>
          <button
            onClick={() => wizard.goNext()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-green-500 hover:to-emerald-500"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-md pt-8 text-center"
      >
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 backdrop-blur-xl">
          <div className="mb-4 flex justify-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">Something went wrong</h2>
          <p className="mb-6 text-sm text-red-400">{error}</p>
          <button
            onClick={() => {
              provisionStartedRef.current = false;
              setError(null);
              setRetryCount((c) => c + 1);
            }}
            className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-red-500 hover:to-rose-500"
          >
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  const tasks = progress?.completedTasks ?? [];
  const pct = progress?.progress ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md pt-8 text-center"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <div className="mb-6 flex justify-center">
          {starting ? (
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
          ) : (
            <div className="relative">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="rgb(51 65 85)" strokeWidth="6" />
                <circle
                  cx="36" cy="36" r="30" fill="none" stroke="rgb(59 130 246)" strokeWidth="6"
                  strokeDasharray={188.5}
                  strokeDashoffset={188.5 - (188.5 * pct) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                {pct}%
              </span>
            </div>
          )}
        </div>

        <h2 className="mb-2 text-xl font-bold text-white">
          {starting ? 'Starting Provisioning...' : 'Setting Up Your Organization'}
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          {progress?.currentTask ?? 'Preparing your workspace...'}
        </p>

        <div className="space-y-2">
          {['Organization', 'Owner', 'Roles', 'Departments', 'Subscription', 'Settings'].map((label) => {
            const isDone = tasks.some((t) => t.toLowerCase().includes(label.toLowerCase()));
            return (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-slate-800/30 px-4 py-2.5">
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  isDone ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : <div className="h-2 w-2 rounded-full bg-slate-600" />}
                </div>
                <span className={`text-sm ${isDone ? 'text-green-300' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
