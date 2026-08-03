import { motion } from 'framer-motion';
import {
  Users,
  Package,
  Receipt,
  ShoppingBag,
  UserPlus,
  Settings,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { DashboardCard } from '@/components/ui/dashboard-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import type { QuickAction as QuickActionType } from './types';

const iconMap: Record<string, LucideIcon> = {
  Users,
  Package,
  Receipt,
  ShoppingBag,
  UserPlus,
  Settings,
};

const actionDescriptions: Record<string, string> = {
  Users: 'Manage team members',
  Package: 'Add new products',
  Receipt: 'Create new invoice',
  ShoppingBag: 'Record purchases',
  UserPlus: 'Add new customer',
  Settings: 'Configure workspace',
};

interface QuickActionsProps {
  actions: QuickActionType[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <DashboardCard className="p-4">
          <SectionHeader title="Quick Actions" description="Frequently used tasks" />
          <EmptyState
            icon={Settings}
            title="No quick actions available"
            description="Actions will appear as you set up your workspace"
          />
        </DashboardCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <DashboardCard className="flex h-full flex-col p-4">
        <SectionHeader title="Quick Actions" description="Frequently used tasks" />
        <div className="grid flex-1 grid-cols-2 gap-2.5">
          {actions.map((action, index) => {
            const Icon = iconMap[action.icon] ?? Settings;
            const desc = actionDescriptions[action.icon] ?? 'Perform action';

            return (
              <motion.div
                key={action.label}
                className="flex"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                {action.available ? (
                  <Link
                    href={action.href}
                    className="group relative flex w-full flex-1 items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.18)] dark:bg-white/[0.02] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.04] dark:hover:shadow-none"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 transition-colors duration-200 group-hover:bg-white group-hover:text-slate-700 group-hover:shadow-sm dark:bg-white/[0.08] dark:text-slate-400 dark:group-hover:bg-white/[0.12] dark:group-hover:text-white dark:group-hover:shadow-none">
                      <Icon className="h-4 w-4" />
                    </div>
<div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium leading-snug tracking-tight">{action.label}</p>
                      <p className="mt-1 truncate text-[11px] leading-snug text-muted-foreground">{desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 -translate-x-0.5 text-slate-300 transition-all duration-200 group-hover:translate-x-0 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300" />
                  </Link>
                ) : (
                  <div className="flex w-full flex-1 items-center gap-3 rounded-xl border border-border bg-slate-50/60 p-3.5 opacity-60 dark:bg-white/[0.02]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-400 dark:bg-white/[0.08] dark:text-slate-500">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium leading-snug tracking-tight text-slate-500 dark:text-slate-400">{action.label}</p>
                      <p className="mt-1 truncate text-[11px] leading-snug text-muted-foreground">Coming soon</p>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </DashboardCard>
    </motion.div>
  );
}
