'use client';

import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { refreshAccessToken } from '@/lib/api';
import { createProvisioningMonitor } from '@/lib/provisioning-monitor';
import {
  getSession, getProvisioningProgress, provisionOrganization, createProvisioningEventSource, getProvisioningSseToken,
  type OnboardingSession, type ProvisioningProgress,
} from '@/lib/onboarding-api';

const POLL_INTERVAL_MS = 2000;
const POLL_EMPTY_LIMIT = 5;
const SUCCESS_STEP = 8;

export default function ProvisioningPage() {
  const { wizard, session, completeStep, persistSession } = useOnboarding();
  const goTo = wizard.goTo;
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ProvisioningProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const completionTriggeredRef = useRef(false);
  const failureTriggeredRef = useRef(false);
  const navigationTriggeredRef = useRef(false);
  const mountedRef = useRef(true);
  const progressRef = useRef<ProvisioningProgress | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const completeProvisioning = useCallback(async () => {
    if (completionTriggeredRef.current) return;
    completionTriggeredRef.current = true;

    try {
      await completeStep(7);
      await refreshAccessToken();
    } catch {
      // provisioning already completed server-side; proceed regardless
    }

    if (!mountedRef.current) return;

    void queryClient.invalidateQueries({ queryKey: ['billing'] });
    void queryClient.invalidateQueries({ queryKey: ['onboarding'] });

    if (!navigationTriggeredRef.current) {
      navigationTriggeredRef.current = true;
      goTo(SUCCESS_STEP);
    }
  }, [completeStep, goTo, queryClient]);

  const failProvisioning = useCallback((message: string) => {
    if (!mountedRef.current || completionTriggeredRef.current) return;
    if (failureTriggeredRef.current) return;
    failureTriggeredRef.current = true;

    setStarting(false);
    setError(message);
  }, []);

  const markCompletedFromSession = useCallback(
    (s: OnboardingSession) => {
      const completed: ProvisioningProgress = {
        sessionId: s.id,
        status: 'COMPLETED',
        progress: 100,
        currentTask: 'Complete',
        completedTasks: (s.provisionData as { completedTasks?: string[] } | null)?.completedTasks ?? [],
        failedTask: null,
        error: null,
      };
      progressRef.current = completed;
      setProgress(completed);
      void completeProvisioning();
    },
    [completeProvisioning],
  );

  useEffect(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (completionTriggeredRef.current) return;

    if (s.provisionStatus === 'COMPLETED') {
      markCompletedFromSession(s);
      return;
    }

    const sessionStatus = s.provisionStatus as string;
    const isTerminalFailure =
      sessionStatus === 'FAILED' ||
      sessionStatus === 'CANCELLED' ||
      sessionStatus === 'EXPIRED' ||
      (sessionStatus !== 'PENDING' && sessionStatus !== 'PROVISIONING');
    if (isTerminalFailure && retryCount === 0) {
      setError(
        sessionStatus === 'FAILED'
          ? 'Previous provisioning failed. Retry to resume.'
          : `Unexpected provisioning status "${sessionStatus}". Retry to resume.`,
      );
      return;
    }

    const provisionActive =
      sessionStatus === 'PROVISIONING' || (sessionStatus === 'FAILED' && retryCount > 0);
    if (!(s.completedSteps ?? []).includes(6) && !provisionActive) {
      goTo(6);
      return;
    }

    const monitor = createProvisioningMonitor({
      sessionId: s.id,
      pollIntervalMs: POLL_INTERVAL_MS,
      pollEmptyLimit: POLL_EMPTY_LIMIT,
      source: {
        createStream: createProvisioningEventSource,
        getSseToken: getProvisioningSseToken,
        fetchProgress: getProvisioningProgress,
        provision: async (sid) => {
          const current = sessionRef.current;
          setStarting(true);
          try {
            const persisted = await persistSession();
            const latestSession = await getSession(sid).catch(() => persisted ?? current);
            const sessionData = latestSession ?? persisted ?? current;
            if (!sessionData || !sessionData.selectedIndustry || !sessionData.orgName) {
              setError('Missing required onboarding data. Redirecting to the step that still needs input.');
              goTo(!sessionData?.selectedIndustry ? 1 : 2);
              return { kind: 'stop' as const };
            }
            // Provisioning is already running server-side (browser refresh, back
            // navigation, or a second tab). Do NOT fire a duplicate provision
            // request — the engine rejects re-entry with a 409 and the active
            // monitor keeps delivering progress. Just keep watching.
            if (sessionData.provisionStatus === 'PROVISIONING') {
              return { kind: 'monitor' as const };
            }
            const result = await provisionOrganization(sid, {
              selectedIndustry: sessionData.selectedIndustry,
              orgName: sessionData.orgName,
            });
            if (result?.provisionStatus === 'COMPLETED') {
              return {
                kind: 'completed' as const,
                completedTasks: (result.provisionData as { completedTasks?: string[] } | null)?.completedTasks ?? [],
              };
            }
            // PROVISIONING => keep waiting on SSE/polling.
            return { kind: 'monitor' as const };
          } finally {
            setStarting(false);
          }
        },
      },
      callbacks: {
        onProgress: (p) => {
          progressRef.current = p as ProvisioningProgress;
          setProgress(p as ProvisioningProgress);
        },
        onComplete: () => {
          void completeProvisioning();
        },
        onFail: (message) => failProvisioning(message),
      },
    });

    monitor.start();

    return () => {
      monitor.stop();
    };
  }, [session?.id, retryCount, markCompletedFromSession, completeProvisioning, failProvisioning, goTo, persistSession]);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
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
              completionTriggeredRef.current = false;
              failureTriggeredRef.current = false;
              navigationTriggeredRef.current = false;
              progressRef.current = null;
              setProgress(null);
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
