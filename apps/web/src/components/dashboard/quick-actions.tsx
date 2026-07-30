import { motion } from 'framer-motion';
import {
  Users,
  Package,
  Receipt,
  ShoppingBag,
  UserPlus,
  Settings,
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

const iconBgColors: Record<string, string> = {
  Users: 'bg-blue-50 text-blue-600',
  Package: 'bg-violet-50 text-violet-600',
  Receipt: 'bg-rose-50 text-rose-600',
  ShoppingBag: 'bg-cyan-50 text-cyan-600',
  UserPlus: 'bg-emerald-50 text-emerald-600',
  Settings: 'bg-slate-50 text-slate-600',
};

interface QuickActionsProps {
  actions: QuickActionType[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <DashboardCard className="p-5">
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <DashboardCard className="p-5">
        <SectionHeader title="Quick Actions" description="Frequently used tasks" />
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action, index) => {
            const Icon = iconMap[action.icon] ?? Settings;
            const desc = actionDescriptions[action.icon] ?? 'Perform action';
            const colors = iconBgColors[action.icon] ?? 'bg-slate-50 text-slate-600';

            return (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                {action.available ? (
                  <Link
                    href={action.href}
                    className="group block rounded-xl border border-slate-100 bg-white p-3 hover:border-red-100 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors} group-hover:scale-105 transition-transform mb-2`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{action.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                  </Link>
                ) : (
                  <div className="block rounded-xl border border-slate-100 bg-slate-50/50 p-3 opacity-60 cursor-not-allowed">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400 mb-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400">{action.label}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Coming soon</p>
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
