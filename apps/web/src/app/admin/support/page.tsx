'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LifeBuoy, MessageSquare, Timer, Zap } from 'lucide-react';

import { getAdminDashboard } from '@/lib/api';
import { ActivityList } from '@/components/admin/activity-list';
import { KpiCard } from '@/components/admin/kpi-card';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';
import type { KpiMetric } from '@/components/admin/types';

export default function AdminSupportPage() {
  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => getAdminDashboard(), staleTime: 30_000 });

  if (dash.isLoading || !dash.data) {
    return (
      <div className="space-y-4">
        <LoadingState rows={2} />
      </div>
    );
  }
  if (dash.isError) {
    return <ErrorState message="Could not load support data" onRetry={() => dash.refetch()} />;
  }

  const d = dash.data as Record<string, unknown>;

  const kpis: KpiMetric[] = [
    { key: 'open', label: 'Open Tickets', value: 0, icon: LifeBuoy, tone: 'warning' },
    { key: 'resolved', label: 'Resolved', value: 0, icon: CheckCircle2, tone: 'success' },
    { key: 'pending', label: 'Pending', value: 0, icon: Timer, tone: 'neutral' },
    { key: 'chat', label: 'Active Chats', value: 0, icon: MessageSquare, tone: 'info' },
  ];

  const priorityEvents = ((d.recentActivities ?? []) as { id: string; action: string; createdAt: string; user: { name: string; email: string } | null }[]).filter((a) => /error|fail|support|ticket/i.test(a.action)).slice(0, 8);

  return (
    <div className="space-y-4">
      <PageHeader title="Support Tickets" description="Customer support workload" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((m) => (
          <KpiCard key={m.key} metric={m} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Priority" description="Ticket severity breakdown">
          <div className="space-y-2">
            {[
              { label: 'High', tone: 'danger' as const },
              { label: 'Medium', tone: 'warning' as const },
              { label: 'Low', tone: 'neutral' as const },
            ].map((p) => (
              <div key={p.label} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[13px] text-foreground">{p.label} priority</span>
                </div>
                <StatusBadge label="0" tone={p.tone} />
              </div>
            ))}
          </div>
        </PanelCard>
        <PanelCard title="Live Chat" description="Realtime conversations">
          <EmptyState icon={MessageSquare} title="Live chat not available" description="The live chat module is not connected yet." />
        </PanelCard>
      </div>

      <PanelCard title="Recent Support Activity" description="Support-related audit events">
        {priorityEvents.length > 0 ? (
          <ActivityList items={priorityEvents.map((a) => ({
            id: a.id,
            title: a.action,
            description: a.user ? `${a.user.name} (${a.user.email})` : 'System',
            icon: LifeBuoy,
            tone: 'neutral',
            timestamp: a.createdAt,
          }))} />
        ) : (
          <EmptyState icon={LifeBuoy} title="No support activity" description="Ticket events will appear here once recorded." />
        )}
      </PanelCard>
    </div>
  );
}
