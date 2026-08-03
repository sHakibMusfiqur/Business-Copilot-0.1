'use client';

import { motion } from 'framer-motion';
import { CalendarDays, Sparkles, Zap } from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';

function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

interface DashboardHeaderProps {
  organizationName: string;
}

export function DashboardHeader({ organizationName }: DashboardHeaderProps) {
  const user = useAuthStore((state) => state.user);
  const dateString = getFormattedDate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="space-y-3">
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[32px] sm:leading-[1.1]">
          Welcome back, <span className="text-gradient">{user?.name?.split(' ')[0] ?? 'User'}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-normal text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            {dateString}
          </span>
          <span className="hidden h-3.5 w-px bg-slate-200 dark:bg-white/10 sm:block" />
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 dark:bg-white/[0.08]">
              <Sparkles className="h-3 w-3 text-slate-400 dark:text-slate-500" />
            </span>
            {organizationName}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Enterprise plan
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-xs font-semibold text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <Zap className="h-3.5 w-3.5" />
          14 days left in trial
        </span>
      </div>
    </motion.div>
  );
}