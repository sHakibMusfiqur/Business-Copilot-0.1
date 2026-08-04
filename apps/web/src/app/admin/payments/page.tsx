'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Landmark, Wallet } from 'lucide-react';

import { getAdminDashboard } from '@/lib/api';
import { ActivityList } from '@/components/admin/activity-list';
import { KpiCard } from '@/components/admin/kpi-card';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';
import type { KpiMetric } from '@/components/admin/types';

const GATEWAYS = [
  { code: 'stripe', name: 'Stripe' },
  { code: 'sslcommerz', name: 'SSLCommerz' },
  { code: 'bkash', name: 'bKash' },
  { code: 'nagad', name: 'Nagad' },
  { code: 'rocket', name: 'Rocket' },
];

export default function AdminPaymentsPage() {
  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => getAdminDashboard(), staleTime: 30_000 });

  if (dash.isLoading || !dash.data) {
    return (
      <div className="space-y-4">
        <LoadingState rows={2} />
      </div>
    );
  }
  if (dash.isError) {
    return <ErrorState message="Could not load payment data" onRetry={() => dash.refetch()} />;
  }

  const d = dash.data;
  const kpis: KpiMetric[] = [
    { key: 'today', label: 'Collected Today', value: d.revenue?.today ?? 0, isCurrency: true, icon: Wallet, tone: 'success' },
    { key: 'month', label: 'Collected This Month', value: d.revenue?.thisMonth ?? 0, isCurrency: true, icon: Landmark, tone: 'info' },
    { key: 'lifetime', label: 'Lifetime Collection', value: d.revenue?.lifetime ?? 0, isCurrency: true, icon: Landmark, tone: 'violet' },
    { key: 'failed', label: 'Failed Events Today', value: d.recentErrors?.length ?? 0, icon: AlertTriangle, tone: 'danger' },
  ];

  const paymentEvents = (d.recentActivities as { id: string; action: string; createdAt: string; user: { name: string; email: string } | null }[] ?? [])
    .filter((a) => /payment|invoice|subscription/i.test(a.action))
    .slice(0, 8);

  const failedEvents = (d.recentErrors as { id: string; action: string; createdAt: string; user: { name: string; email: string } | null }[] ?? []).slice(0, 8);

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" description="Payment gateways and transaction overview" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((m) => (
          <KpiCard key={m.key} metric={m} />
        ))}
      </div>

      <PanelCard title="Gateways" description="Configured payment providers">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {GATEWAYS.map((g) => (
            <div key={g.code} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground">{g.name}</span>
              </div>
              <StatusBadge label="Not connected" tone="neutral" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Gateway connection status is managed by the platform billing settings.
        </p>
      </PanelCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Latest Transactions" description="Recent payment-related audit events">
          {paymentEvents.length > 0 ? (
            <ActivityList items={paymentEvents.map((a) => ({
              id: a.id,
              title: a.action,
              description: a.user ? `${a.user.name} (${a.user.email})` : 'System',
              icon: Wallet,
              tone: 'success',
              timestamp: a.createdAt,
            }))} />
          ) : (
            <EmptyState icon={CheckCircle2} title="No transactions today" description="Payment events will appear here once recorded." />
          )}
        </PanelCard>
        <PanelCard title="Failed Payments" description="Latest failures">
          {failedEvents.length > 0 ? (
            <ActivityList items={failedEvents.map((a) => ({
              id: a.id,
              title: a.action,
              description: a.user ? `${a.user.name} (${a.user.email})` : 'System',
              icon: AlertTriangle,
              tone: 'danger',
              timestamp: a.createdAt,
            }))} />
          ) : (
            <EmptyState icon={CheckCircle2} title="No failed payments" description="No failures recorded today." />
          )}
        </PanelCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Pending Payments" icon={Clock}>
          <EmptyState icon={Clock} title="No pending payments" description="Pending payment processing is not tracked yet." />
        </PanelCard>
        <PanelCard title="Gateway Breakdown" icon={Landmark}>
          <EmptyState icon={Landmark} title="No gateway data" description="Per-gateway transaction volumes are not available yet." />
        </PanelCard>
      </div>
    </div>
  );
}
