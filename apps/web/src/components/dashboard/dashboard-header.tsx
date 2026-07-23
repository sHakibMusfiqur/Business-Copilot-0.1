'use client';

import { motion } from 'framer-motion';

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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] ?? 'User'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {organizationName} &middot; Workspace overview
        </p>
      </div>
      <time className="text-sm text-muted-foreground mt-2 sm:mt-0">
        {dateString}
      </time>
    </motion.div>
  );
}
