'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

import { getAdminDashboard } from '@/lib/api';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { ErrorState, LoadingState, EmptyState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';

interface PlatformNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
}

function deriveNotifications(data: Record<string, unknown>): PlatformNotification[] {
  const items: PlatformNotification[] = [];
  const errors = data.recentErrors as { id: string; action: string; createdAt: string }[] | undefined;
  const activities = data.recentActivities as { id: string; action: string; createdAt: string }[] | undefined;
  const subs = data.subscriptions as { recentPayments?: { id: string; status: string; amount: number; currency: string; createdAt: string }[] } | undefined;

  if (errors?.length) {
    errors.slice(0, 5).forEach((e, i) => {
      items.push({
        id: `error-${i}`,
        type: 'error',
        title: 'Platform Error',
        message: e.action || 'Unknown error',
        timestamp: e.createdAt || new Date().toISOString(),
      });
    });
  }

  if (activities?.length) {
    activities.slice(0, 5).forEach((a, i) => {
      items.push({
        id: `activity-${i}`,
        type: 'info',
        title: a.action || 'Activity',
        message: a.id || 'No details',
        timestamp: a.createdAt || new Date().toISOString(),
      });
    });
  }

  if (subs?.recentPayments?.length) {
    subs.recentPayments.slice(0, 3).forEach((p, i) => {
      items.push({
        id: `payment-${i}`,
        type: p.status === 'succeeded' ? 'success' : p.status === 'failed' ? 'error' : 'warning',
        title: `Payment ${p.status || 'update'}`,
        message: `$${(p.amount ?? 0) / 100} ${(p.currency ?? 'usd').toUpperCase()}`,
        timestamp: p.createdAt || new Date().toISOString(),
      });
    });
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
}

const TYPE_ICON: Record<string, typeof Bell> = { error: X, warning: AlertTriangle, info: Info, success: CheckCircle2 };

export default function AdminNotificationsPage() {
  const dash = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => getAdminDashboard(),
    staleTime: 30_000,
  });

  if (dash.isLoading) {
    return <LoadingState rows={2} />;
  }

  if (dash.isError) {
    return <ErrorState message="Could not load notifications" onRetry={() => dash.refetch()} />;
  }

  const notifications = deriveNotifications(dash.data as Record<string, unknown>);

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" description="Platform-wide alerts and events" />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="No platform events to display." />
      ) : (
        <PanelCard title="Recent Notifications" icon={Bell} padded={false}>
          <div className="divide-y divide-border">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] || Info;
              return (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground">{n.title}</p>
                      <StatusBadge
                        label={n.type}
                        tone={n.type === 'error' ? 'danger' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info'}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{n.message}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(n.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </PanelCard>
      )}

      <PanelCard title="Notification Preferences" icon={Bell}>
        <p className="text-[13px] text-muted-foreground">
          Email and push notification preferences are managed at the organization level.
          Platform-wide alerts are displayed here automatically.
        </p>
      </PanelCard>
    </div>
  );
}
