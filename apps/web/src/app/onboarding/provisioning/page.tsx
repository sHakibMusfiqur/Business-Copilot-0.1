'use client';

import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, ArrowRight, PartyPopper } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { refreshAccessToken } from '@/lib/api';
import {
  getSession, getProvisioningProgress, provisionOrganization, createProvisioningEventSource,
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
  const doneRef = useRef(false);
  const progressRef = useRef<ProvisioningProgress | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    doneRef.current = done;
  }, [done]);

  useEffect(() => {
    if (!session) return;
    if (provisionStartedRef.current) return;

    if (session.provisionStatus === 'COMPLETED') {
      void refreshAccessToken().catch(() => {});
      doneRef.current = true;
      setDone(true);
      return;
    }

    // Provisioning must only begin after payment success or free trial
    // activation (Payment step completed). Sessions already mid-provisioning
    // (PROVISIONING/FAILED) are allowed to resume.
    const provisionActive =
      session.provisionStatus === 'PROVISIONING' || session.provisionStatus === 'FAILED';
    if (!(session.completedSteps ?? []).includes(6) && !provisionActive) {
      wizard.goTo(6);
      return;
    }

    if (session.provisionStatus === 'FAILED' && retryCount === 0) {
      setError('Previous provisioning failed. Retry to resume.');
      return;
    }

    provisionStartedRef.current = true;
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let streamOpened = false;
    let eventsSeen = false;
    let triggered = false;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const clearTimers = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      stopPolling();
    };

    const closeEventSource = () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };

    const cleanupAll = () => {
      active = false;
      clearTimers();
      closeEventSource();
    };

    const handleProgressEvent = (data: {
      progress?: number;
      currentTask?: string | null;
      completedTasks?: string[];
      failedTask?: string | null;
    }, status: 'PROVISIONING' | 'COMPLETED') => {
      setProgress((prev) => ({
        sessionId: session.id,
        status,
        progress: data.progress ?? prev?.progress ?? 0,
        currentTask: data.currentTask ?? prev?.currentTask ?? null,
        completedTasks: data.completedTasks ?? prev?.completedTasks ?? [],
        failedTask: data.failedTask ?? null,
        error: null,
      }));
      if (status === 'COMPLETED') {
        clearTimers();
        closeEventSource();
      }
    };

    const pollProgress = async () => {
      if (!active) return;
      try {
        const prog = await getProvisioningProgress(session.id);
        if (!prog || !active) return;
        setProgress((prev) => ({
          sessionId: session.id,
          status: prog.status,
          progress: prog.progress ?? prev?.progress ?? 0,
          currentTask: prog.currentTask ?? prev?.currentTask ?? null,
          completedTasks: prog.completedTasks ?? prev?.completedTasks ?? [],
          failedTask: prog.failedTask ?? null,
          error: prog.error ?? null,
        }));
        if (prog.status === 'COMPLETED') {
          clearTimers();
          closeEventSource();
        }
      } catch { /* ignore polling errors */ }
    };

    const startProvision = async () => {
      setStarting(true);

      const es = createProvisioningEventSource(session.id);
      esRef.current = es;

      const triggerProvision = async () => {
        if (triggered) return;
        triggered = true;
        try {
          const persisted = await persistSession();
          if (!active) return;
          const latestSession = await getSession(session.id).catch(() => persisted ?? session);
          if (!active) return;
          const sessionData = latestSession ?? persisted ?? session;
          if (!sessionData.selectedIndustry || !sessionData.orgName) {
            provisionStartedRef.current = false;
            setStarting(false);
            setError('Missing required onboarding data. Redirecting to the step that still needs input.');
            wizard.goTo(!sessionData.selectedIndustry ? 1 : 2);
            return;
          }
          const result = await provisionOrganization(session.id, {
            selectedIndustry: sessionData.selectedIndustry,
            orgName: sessionData.orgName,
          });
          if (!active) return;
          setStarting(false);

          if (result?.provisionStatus === 'COMPLETED') {
            handleProgressEvent({
              progress: 100,
              currentTask: 'Complete',
              completedTasks: (result.provisionData as { completedTasks?: string[] } | null)?.completedTasks ?? [],
            }, 'COMPLETED');
          }
        } catch (e) {
          provisionStartedRef.current = false;
          setError((e as Error).message ?? 'Provisioning failed to start');
          setStarting(false);
          return;
        }
      };

      es.addEventListener('provisioning', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!active) return;
          eventsSeen = true;
          if (data.progress === 100) {
            handleProgressEvent(data, 'COMPLETED');
          } else {
            handleProgressEvent(data, 'PROVISIONING');
          }
        } catch { /* ignore parse errors */ }
      });

      es.onopen = () => {
        streamOpened = true;
        if (!active) return;
        void triggerProvision();
      };

      // Fallback polling: if the stream never opened or no events arrive
      // within 3 seconds, poll the progress endpoint every 2 seconds.
      fallbackTimer = setTimeout(() => {
        if (!active) return;
        if (eventsSeen || doneRef.current || progressRef.current?.status === 'COMPLETED') return;
        if (pollTimer) return;
        void pollProgress();
        pollTimer = setInterval(() => { void pollProgress(); }, 2000);
      }, 3000);

      // Safety: if the stream cannot open, still run provisioning after 5s.
      safetyTimer = setTimeout(() => {
        if (!active) return;
        if (triggered) return;
        if (streamOpened) return;
        void triggerProvision();
      }, 5000);
    };

    void startProvision();

    return () => {
      cleanupAll();
    };
  }, [session, retryCount]);

  useEffect(() => {
    if (done || progress?.status !== 'COMPLETED') return;
    let active = true;
    (async () => {
      try {
        await completeStep(7);
        await refreshAccessToken();
      } catch {
        // provisioning already completed server-side; proceed regardless
      } finally {
        if (active) {
          doneRef.current = true;
          setDone(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [done, progress?.status]);

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
              if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
              }
              doneRef.current = false;
              progressRef.current = null;
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
