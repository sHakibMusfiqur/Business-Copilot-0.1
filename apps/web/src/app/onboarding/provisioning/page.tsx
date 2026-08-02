'use client';

import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { refreshAccessToken } from '@/lib/api';
import {
  getSession, getProvisioningProgress, provisionOrganization, createProvisioningEventSource,
  type ProvisioningProgress,
} from '@/lib/onboarding-api';

const POLL_INTERVAL_MS = 2000;
const POLL_EMPTY_LIMIT = 5;
const SUCCESS_STEP = 8;

const KNOWN_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'PROVISIONING', 'COMPLETED', 'FAILED']);

type ProgressInput = {
  status?: string;
  progress?: number;
  currentTask?: string | null;
  completedTasks?: string[];
  failedTask?: string | null;
  error?: string | null;
};

function isCompleted(p: { status?: string; progress?: number }): boolean {
  return p.status === 'COMPLETED' || (p.status !== 'FAILED' && typeof p.progress === 'number' && p.progress >= 100);
}

export default function ProvisioningPage() {
  const { wizard, session, completeStep, persistSession } = useOnboarding();
  const goTo = wizard.goTo;
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ProvisioningProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const provisionStartedRef = useRef(false);
  const completionTriggeredRef = useRef(false);
  const failureTriggeredRef = useRef(false);
  const navigationTriggeredRef = useRef(false);
  const emptyPollCountRef = useRef(0);
  const mountedRef = useRef(true);
  const progressRef = useRef<ProvisioningProgress | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sessionIdRef = useRef<string | null>(session?.id ?? null);
  if (session) sessionIdRef.current = session.id;

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const closeEventSource = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const completeProvisioning = useCallback(async () => {
    if (completionTriggeredRef.current) return;
    completionTriggeredRef.current = true;

    clearTimers();
    closeEventSource();

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
  }, [clearTimers, closeEventSource, completeStep, goTo, queryClient]);

  const failProvisioning = useCallback((message: string) => {
    if (!mountedRef.current || completionTriggeredRef.current) return;
    if (failureTriggeredRef.current) return;
    failureTriggeredRef.current = true;

    clearTimers();
    closeEventSource();
    setStarting(false);
    setError(message);
  }, [clearTimers, closeEventSource]);

  const handleProgress = useCallback((input: ProgressInput) => {
    if (!mountedRef.current) return;
    const sid = sessionIdRef.current;
    if (!sid) return;

    const status = input.status ?? progressRef.current?.status ?? 'PROVISIONING';

    if (status === 'FAILED' || status === 'CANCELLED' || !KNOWN_STATUSES.has(status)) {
      failProvisioning(input.error ?? `Provisioning ended with status "${status}". Retry to resume.`);
      return;
    }

    const prev = progressRef.current;
    const merged: ProvisioningProgress = {
      sessionId: sid,
      status: status as ProvisioningProgress['status'],
      progress: input.progress ?? prev?.progress ?? 0,
      currentTask: input.currentTask ?? prev?.currentTask ?? null,
      completedTasks: input.completedTasks ?? prev?.completedTasks ?? [],
      failedTask: input.failedTask ?? null,
      error: input.error ?? null,
    };
    progressRef.current = merged;
    setProgress(merged);
    if (isCompleted(merged)) {
      void completeProvisioning();
    }
  }, [completeProvisioning, failProvisioning]);

  const pollProgress = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || completionTriggeredRef.current || failureTriggeredRef.current) return;
    try {
      const prog = await getProvisioningProgress(sid);
      if (!prog) {
        emptyPollCountRef.current += 1;
        if (emptyPollCountRef.current >= POLL_EMPTY_LIMIT) {
          failProvisioning('Provisioning progress is unavailable. Retry to resume.');
        }
        return;
      }
      emptyPollCountRef.current = 0;
      if (!mountedRef.current) return;
      handleProgress(prog);
    } catch {
      emptyPollCountRef.current += 1;
      if (emptyPollCountRef.current >= POLL_EMPTY_LIMIT) {
        failProvisioning('Provisioning progress is unavailable. Retry to resume.');
      }
    }
  }, [handleProgress, failProvisioning]);

  useEffect(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (completionTriggeredRef.current) return;

    if (s.provisionStatus === 'COMPLETED') {
      handleProgress({
        status: 'COMPLETED',
        progress: 100,
        currentTask: 'Complete',
        completedTasks: (s.provisionData as { completedTasks?: string[] } | null)?.completedTasks ?? [],
      });
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

    if (provisionStartedRef.current) return;
    provisionStartedRef.current = true;

    const sid = s.id;
    let active = true;
    let triggered = false;

    const triggerProvision = async () => {
      if (!active || triggered) return;
      triggered = true;
      setStarting(true);
      try {
        const current = sessionRef.current;
        const persisted = await persistSession();
        if (!active) return;
        const latestSession = await getSession(sid).catch(() => persisted ?? current);
        if (!active) return;
        const sessionData = latestSession ?? persisted ?? current;
        if (!sessionData || !sessionData.selectedIndustry || !sessionData.orgName) {
          provisionStartedRef.current = false;
          setStarting(false);
          setError('Missing required onboarding data. Redirecting to the step that still needs input.');
          goTo(!sessionData?.selectedIndustry ? 1 : 2);
          return;
        }

        // Provisioning is already running server-side (browser refresh, back
        // navigation, or a second tab). Do NOT fire a duplicate provision
        // request — the engine rejects re-entry with a 409 and the active
        // SSE/polling stream will deliver progress. Just keep watching.
        if (sessionData.provisionStatus === 'PROVISIONING') {
          return;
        }

        const result = await provisionOrganization(sid, {
          selectedIndustry: sessionData.selectedIndustry,
          orgName: sessionData.orgName,
        });
        if (!active) return;

        if (result?.provisionStatus === 'COMPLETED') {
          handleProgress({
            status: 'COMPLETED',
            progress: 100,
            currentTask: 'Complete',
            completedTasks: (result.provisionData as { completedTasks?: string[] } | null)?.completedTasks ?? [],
          });
        }
        // PROVISIONING => keep waiting on SSE/polling.
      } catch (e) {
        failProvisioning((e as Error).message ?? 'Provisioning failed to start');
      } finally {
        if (active) setStarting(false);
      }
    };

    const startPolling = () => {
      if (!active || completionTriggeredRef.current || failureTriggeredRef.current) return;
      if (pollTimerRef.current) return;
      void pollProgress();
      pollTimerRef.current = setInterval(() => { void pollProgress(); }, POLL_INTERVAL_MS);
    };

    const es = createProvisioningEventSource(sid);
    esRef.current = es;

    es.addEventListener('provisioning', (event) => {
      if (!active || completionTriggeredRef.current || failureTriggeredRef.current) return;
      try {
        const data = JSON.parse(event.data) as ProgressInput;
        handleProgress(data);
      } catch {
        // ignore malformed events
      }
    });

    es.onopen = () => {
      if (!active) return;
      void triggerProvision();
    };

    es.onerror = () => {
      // SSE failed or disconnected: fall back to polling until completed.
      if (!active || completionTriggeredRef.current || failureTriggeredRef.current) return;
      startPolling();
    };

    fallbackTimerRef.current = setTimeout(() => {
      if (!active || completionTriggeredRef.current || failureTriggeredRef.current) return;
      startPolling();
    }, 3000);

    safetyTimerRef.current = setTimeout(() => {
      if (!active || completionTriggeredRef.current || failureTriggeredRef.current) return;
      if (triggered) return;
      void triggerProvision();
    }, 5000);

    const handlePageHide = () => {
      clearTimers();
      closeEventSource();
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      active = false;
      provisionStartedRef.current = false;
      clearTimers();
      closeEventSource();
    };
  }, [session?.id, retryCount, handleProgress, pollProgress, failProvisioning, clearTimers, closeEventSource, goTo, persistSession]);

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
              closeEventSource();
              clearTimers();
              completionTriggeredRef.current = false;
              failureTriggeredRef.current = false;
              navigationTriggeredRef.current = false;
              provisionStartedRef.current = false;
              emptyPollCountRef.current = 0;
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
