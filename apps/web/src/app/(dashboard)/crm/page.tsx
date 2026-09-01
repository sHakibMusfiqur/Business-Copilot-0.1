'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users2,
  Target,
  TrendingUp,
  DollarSign,
  XCircle,
  CalendarClock,
  Phone,
  Mail,
  Users,
  ClipboardList,
} from 'lucide-react';

import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_READ } from '@/lib/permissions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { getCrmSummary } from '@/lib/api';
import type { LeadSummary, Activity } from '@/components/crm/crm-types';
import { ACTIVITY_TYPE_STYLES } from '@/components/crm/crm-types';

const activityTypeIcon: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  TASK: ClipboardList,
  NOTE: ClipboardList,
};

export default function CrmDashboardPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const canRead = isLoaded && hasPermission(CRM_READ);

  const summaryQuery = useQuery<LeadSummary>({
    queryKey: ['crm', 'summary'],
    queryFn: () => getCrmSummary(),
    enabled: canRead,
  });

  if (!canRead) {
    return <ForbiddenState title="Access restricted" description="You don't have permission to view CRM. Contact your organization administrator." />;
  }

  if (summaryQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (summaryQuery.isError) {
    return (
      <DashboardError
        message={summaryQuery.error instanceof Error ? summaryQuery.error.message : undefined}
        onRetry={() => summaryQuery.refetch()}
      />
    );
  }

  const summary = summaryQuery.data as LeadSummary;

  const statCards = [
    {
      label: 'Total Leads',
      value: summary.totalLeads,
      icon: Users2,
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
    },
    {
      label: 'Qualified',
      value: summary.qualifiedLeads,
      icon: Target,
      color: 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30',
    },
    {
      label: 'Won',
      value: summary.wonLeads,
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
    },
    {
      label: 'Lost',
      value: summary.lostLeads,
      icon: XCircle,
      color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(summary.pipelineValue),
      icon: DollarSign,
      color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
    },
    {
      label: 'Conversion Rate',
      value: `${summary.conversionRate}%`,
      icon: TrendingUp,
      color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your sales pipeline and lead activities
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`rounded-lg p-1.5 ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 p-4 border-b">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Upcoming Activities & Tasks</h2>
        </div>
        {summary.upcomingActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No upcoming activities</p>
            <p className="text-xs text-muted-foreground">No pending activities or tasks scheduled.</p>
          </div>
        ) : (
          <div className="divide-y">
            {summary.upcomingActivities.map((activity: Activity) => {
              const Icon = activityTypeIcon[activity.type] ?? ClipboardList;
              return (
                <div key={activity.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <div className={`rounded-lg p-1.5 ${ACTIVITY_TYPE_STYLES[activity.type] ?? 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    {activity.lead && (
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.lead.name} ({activity.lead.leadNumber})
                      </p>
                    )}
                  </div>
                  {activity.dueDate && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(activity.dueDate)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
