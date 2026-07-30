'use client';

import { motion } from 'framer-motion';
import {
  PartyPopper, ArrowRight, Check, X, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import {
  getChecklist, skipChecklistItem, getChecklistProgress,
  type ChecklistItem, type ChecklistProgress,
} from '@/lib/onboarding-api';

export default function SuccessPage() {
  const { session } = useOnboarding();
  const orgId = session?.organizationId;
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState<ChecklistProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipping, setSkipping] = useState<string | null>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const fetchData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [checklist, p] = await Promise.all([
        getChecklist(session.id),
        getChecklistProgress(session.id),
      ]);
      setItems(checklist);
      setProgress(p);
    } catch {
      /* intentional */
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchData();
  }, [session, fetchData]);

  useEffect(() => {
    const handleRefresh = () => {
      if (loadingRef.current) return;
      fetchData();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleRefresh();
    };
    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  const handleSkip = async (item: ChecklistItem) => {
    if (!session || skipping || !item.skippable) return;
    setSkipping(item.itemId);
    try {
      const updated = await skipChecklistItem(session.id, item.itemId);
      setItems((prev) => prev.map((i) => i.itemId === updated.itemId ? updated : i));
      const p = await getChecklistProgress(session.id);
      setProgress(p);
    } catch {
      /* empty - network errors ignored */
    } finally {
      setSkipping(null);
    }
  };

  const completedCount = items.filter((i) => i.completed).length;
  const pct = progress?.percentage ?? (items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl pt-4"
    >
      <div className="mb-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="mb-4 flex justify-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 shadow-2xl">
            <PartyPopper className="h-10 w-10 text-white" />
          </div>
        </motion.div>
        <h1 className="mb-2 text-3xl font-bold text-white">Welcome Aboard!</h1>
        <p className="text-slate-400">
          Your organization has been created successfully.
          {orgId && <> Organization ID: <span className="font-mono text-xs text-slate-500">{orgId}</span></>}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Setup Checklist</h2>
            <p className="text-sm text-slate-400">
              {loading ? 'Loading...' : `${completedCount} of ${items.length} complete (${pct}%)`}
            </p>
          </div>
          {!loading && (
            <div className="flex h-14 w-14 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(51 65 85)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="rgb(34 197 94)" strokeWidth="3"
                  strokeDasharray={94.2}
                  strokeDashoffset={94.2 - (94.2 * pct) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
                <text x="18" y="20" textAnchor="middle" className="fill-white text-[8px] font-bold">
                  {pct}%
                </text>
              </svg>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`group flex items-center gap-3 rounded-xl border p-4 transition-all ${
                  item.completed
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-slate-700/50 bg-slate-800/20 hover:border-blue-500/50 hover:bg-blue-500/5'
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                    item.completed
                      ? 'border-green-500 bg-green-500'
                      : 'border-slate-600'
                  }`}
                >
                  {item.completed ? (
                    <Check className="h-3.5 w-3.5 text-white" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${item.completed ? 'text-green-300 line-through' : 'text-white'}`}>
                    {item.label}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.href && !item.completed && (
                    <Link
                      href={item.href}
                      className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400 transition-colors hover:bg-blue-500/20"
                    >
                      Go
                    </Link>
                  )}
                  {item.skippable && !item.completed && (
                    <button
                      onClick={() => handleSkip(item)}
                      disabled={skipping === item.itemId}
                      className="rounded-lg p-1 text-slate-500 transition-colors hover:text-slate-300"
                      title="Skip"
                    >
                      {skipping === item.itemId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500"
        >
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}
