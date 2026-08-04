'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  FileText,
  FlaskConical,
  RefreshCcw,
  RotateCcw,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { getAdminDashboard, getAdminPlans } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AdminButton } from '@/components/admin/admin-button';
import { BarChart } from '@/components/admin/charts';
import { KpiCard } from '@/components/admin/kpi-card';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';
import type { KpiMetric } from '@/components/admin/types';

export default function AdminSubscriptionsPage() {
  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => getAdminDashboard(), staleTime: 30_000 });
  const plans = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => getAdminPlans(), staleTime: 60_000 });

  if (dash.isLoading || !dash.data) {
    return (
      <div className="space-y-4">
        <LoadingState rows={2} />
      </div>
    );
  }
  if (dash.isError) {
    return <ErrorState message="Could not load subscription data" onRetry={() => dash.refetch()} />;
  }

  const d = dash.data;
  const sub = d.subscriptions ?? { trialing: 0, active: 0, expired: 0, cancelled: 0, topPlans: [] };
  const total = sub.trialing + sub.active + sub.expired + sub.cancelled;
  const monthlyRevenue = d.revenue?.thisMonth ?? 0;

  const kpis: KpiMetric[] = [
    { key: 'total', label: 'Total Subscriptions', value: total, icon: CreditCard, tone: 'info' },
    { key: 'active', label: 'Active', value: sub.active, icon: Users, tone: 'success' },
    { key: 'trialing', label: 'Trialing', value: sub.trialing, icon: FlaskConical, tone: 'warning' },
    { key: 'expired', label: 'Expired', value: sub.expired, icon: XCircle, tone: 'danger' },
    { key: 'cancelled', label: 'Cancelled', value: sub.cancelled, icon: RotateCcw, tone: 'neutral' },
    { key: 'mrr', label: 'MRR (this month)', value: monthlyRevenue, isCurrency: true, icon: CreditCard, tone: 'success' },
  ];

  const planDistribution = ((sub.topPlans ?? []) as { name: string; count: number }[]).map((p, i) => ({
    label: p.name,
    value: p.count,
    color: ['hsl(var(--primary))', 'hsl(var(--brand-accent))', 'hsl(var(--brand-secondary))', '#F59E0B', '#8B5CF6'][i % 5],
  }));

  const unsupported = [
    { title: 'Renewals', description: 'Upcoming renewals are not tracked yet.', icon: RefreshCcw },
    { title: 'Refunds', description: 'Refund processing is not available yet.', icon: RotateCcw },
    { title: 'Invoices', description: 'Subscription invoices are not surfaced yet.', icon: FileText },
    { title: 'Coupons', description: 'Coupon & promo code management is not available yet.', icon: Ticket },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscriptions"
        description="Plans, trials, and subscription lifecycle"
        actions={
          <Link href="/admin/plans">
            <AdminButton variant="outline">Manage Plans</AdminButton>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((m) => (
          <KpiCard key={m.key} metric={m} />
        ))}
      </div>

      <PanelCard title="Plan Distribution" description="Subscriptions by plan">
        {planDistribution.length > 0 ? (
          <BarChart data={planDistribution} height={220} />
        ) : (
          <div className="py-10 text-center text-[13px] text-muted-foreground">No subscriptions yet</div>
        )}
      </PanelCard>

      <PanelCard title="Subscription Plans" description="Active catalog">
        {plans.isLoading ? (
          <LoadingState rows={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5">Price</th>
                  <th className="px-4 py-2.5">Interval</th>
                  <th className="px-4 py-2.5">Subscribers</th>
                  <th className="px-4 py-2.5">AI Credits</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {(plans.data ?? []).map((plan: { id: string; name: string; price: number; currency: string; interval: string; aiCredits: number; maxUsers: number; isActive: boolean }) => {
                  const subscribers = ((sub.topPlans ?? []) as { name: string; count: number }[]).find((p) => p.name === plan.name)?.count ?? 0;
                  return (
                    <tr key={plan.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <p className="text-[13px] font-medium text-foreground">{plan.name}</p>
                        <p className="text-[11px] text-muted-foreground">Up to {plan.maxUsers} users</p>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]">{formatCurrency(plan.price, plan.currency)}</td>
                      <td className="px-4 py-2.5 text-[13px] capitalize">{plan.interval.toLowerCase()}</td>
                      <td className="px-4 py-2.5 text-[13px]">{subscribers}</td>
                      <td className="px-4 py-2.5 text-[13px]">{plan.aiCredits}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge label={plan.isActive ? 'Active' : 'Inactive'} tone={plan.isActive ? 'success' : 'neutral'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {unsupported.map((u) => (
          <PanelCard key={u.title} className="border-dashed">
            <EmptyState icon={u.icon} title={u.title} description={u.description} />
          </PanelCard>
        ))}
      </div>
    </div>
  );
}
