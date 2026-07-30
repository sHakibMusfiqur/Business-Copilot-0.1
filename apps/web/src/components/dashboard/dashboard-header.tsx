'use client';

import { motion } from 'framer-motion';
import { Building2, CalendarDays, Sparkles } from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';

function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.name?.split(' ')[0] ?? 'User'}
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-600">
            <Sparkles className="h-3 w-3" />
            Enterprise
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            {organizationName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            {dateString}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            14 days left in trial
          </span>
        </div>
      </div>
    </motion.div>
  );
}
