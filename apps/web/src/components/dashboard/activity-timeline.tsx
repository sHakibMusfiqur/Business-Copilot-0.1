import { motion } from 'framer-motion';
import { Inbox, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { DashboardCard } from '@/components/ui/dashboard-card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ModuleBadge } from '@/components/ui/module-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { generateInitials } from '@/lib/utils';
import type { RecentActivityItem } from './types';

interface ActivityTimelineProps {
  activities: RecentActivityItem[];
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusInfo(entity: string): { label: string; variant: 'success' | 'warning' | 'info' | 'updated' | 'neutral' } {
  const e = entity?.toLowerCase() ?? '';
  if (e.includes('invoice') || e.includes('payment')) return { label: 'Success', variant: 'success' };
  if (e.includes('order') || e.includes('purchase')) return { label: 'Pending', variant: 'warning' };
  if (e.includes('customer') || e.includes('user')) return { label: 'New', variant: 'info' };
  if (e.includes('product')) return { label: 'Updated', variant: 'updated' };
  return { label: 'Info', variant: 'neutral' };
}

function getModuleVariant(entity: string): 'finance' | 'crm' | 'orders' | 'inventory' | 'admin' {
  const e = entity?.toLowerCase() ?? '';
  if (e.includes('invoice') || e.includes('payment') || e.includes('account')) return 'finance';
  if (e.includes('customer') || e.includes('lead')) return 'crm';
  if (e.includes('order') || e.includes('purchase')) return 'orders';
  if (e.includes('product') || e.includes('inventory')) return 'inventory';
  return 'admin';
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <DashboardCard className="p-5 h-full">
        <SectionHeader
          title="Activity"
          description="Latest team actions"
          count={activities.length > 0 ? activities.length : undefined}
        />

        {activities.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No recent activity"
            description="Actions from your team will appear here"
          />
        ) : (
          <div className="space-y-1">
            {activities.slice(0, 5).map((activity) => {
              const userName = activity.user?.name ?? 'System';
              const status = getStatusInfo(activity.entity);
              return (
                <div key={activity.id} className="flex items-start gap-3 py-2.5 group hover:bg-slate-50/50 rounded-xl px-2 -mx-2 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-semibold text-red-600 ring-2 ring-white">
                    {generateInitials(userName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800 truncate">{activity.action}</span>
                      <StatusBadge label={status.label} variant={status.variant} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{userName}</span>
                      <span className="text-slate-300">·</span>
                      <ModuleBadge label={activity.entity} variant={getModuleVariant(activity.entity)} />
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{getRelativeTime(activity.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activities.length > 5 && (
          <Link
            href="/audit"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-slate-100 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all"
          >
            View all activity
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </DashboardCard>
    </motion.div>
  );
}
