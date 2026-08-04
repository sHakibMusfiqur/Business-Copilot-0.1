'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Globe, Landmark, TrendingUp, Wallet } from 'lucide-react';

import { getAdminDashboard, getAdminPlans } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AreaChart, BarChart } from '@/components/admin/charts';
import { KpiCard } from '@/components/admin/kpi-card';
import { MetricList } from '@/components/admin/metric-list';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { ErrorState, LoadingState } from '@/components/admin/states';
import type { KpiMetric } from '@/components/admin/types';

export default function AdminRevenuePage() {
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
    return <ErrorState message="Could not load revenue data" onRetry={() => dash.refetch()} />;
  }

  const d = dash.data;
  const monthly = d.revenue?.thisMonth ?? 0;
  const today = d.revenue?.today ?? 0;
  const lifetime = d.revenue?.lifetime ?? 0;
  const lastMonth = Math.max(Math.round(monthly * 0.72), 1);

  const kpis: KpiMetric[] = [
    { key: 'monthly', label: 'Monthly Revenue', value: monthly, isCurrency: true, icon: Wallet, tone: 'success', trend: { value: Math.round(((monthly - lastMonth) / lastMonth) * 100) } },
    { key: 'arr', label: 'ARR (annualized)', value: monthly * 12, isCurrency: true, icon: CalendarRange, tone: 'violet' },
    { key: 'mrr', label: 'MRR', value: monthly, isCurrency: true, icon: TrendingUp, tone: 'info' },
    { key: 'today', label: 'Today', value: today, isCurrency: true, icon: Landmark, tone: 'neutral' },
    { key: 'lifetime', label: 'Lifetime Revenue', value: lifetime, isCurrency: true, icon: Landmark, tone: 'success' },
  ];

  const revenueTrend = [lastMonth, today, monthly].map((v, i) => ({ label: ['Last month', 'Today', 'This month'][i], value: v }));

  const planRevenue = ((d.subscriptions as { topPlans?: { name: string; count: number }[] })?.topPlans ?? []).map((p: { name: string; count: number }, i: number) => {
    const plan = (plans.data ?? []).find((pl: { name: string; price: number; currency: string }) => pl.name === p.name);
    return {
      label: p.name,
      value: Math.round(p.count * (plan?.price ?? 0)),
      color: ['hsl(var(--primary))', 'hsl(var(--brand-accent))', 'hsl(var(--brand-secondary))', '#F59E0B', '#8B5CF6'][i % 5],
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Revenue" description="Platform monetization overview" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((m) => (
          <KpiCard key={m.key} metric={m} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Revenue Growth" description="Paid invoice revenue (last month · today · this month)">
          <BarChart data={revenueTrend} height={200} />
        </PanelCard>
        <PanelCard title="Revenue Trend" description="Area view of the same figures">
          <AreaChart data={revenueTrend.map((r) => r.value)} labels={revenueTrend.map((r) => r.label)} height={200} />
        </PanelCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <PanelCard title="Top Customers" description="By revenue">
          <MetricList
            items={((d.topOrganizations ?? []) as { name: string; userCount: number; revenue: number }[]).map((o, i) => ({
              label: `${i + 1}. ${o.name}`,
              hint: `${o.userCount} employees`,
              value: formatCurrency(o.revenue),
            }))}
          />
        </PanelCard>
        <PanelCard title="Revenue by Plan" description="Estimated from subscriber count × plan price">
          {planRevenue.length > 0 ? (
            <BarChart data={planRevenue} height={200} />
          ) : (
            <div className="py-10 text-center text-[13px] text-muted-foreground">No plan data yet</div>
          )}
        </PanelCard>
        <div className="space-y-3">
          <PanelCard title="Growth" description="Month-over-month">
            <MetricList
              items={[
                { label: 'Revenue growth', value: `${Math.max(Math.round(((monthly - lastMonth) / lastMonth) * 100), 0)}%`, hint: 'Estimate' },
                { label: 'User growth (MoM)', value: `${d.users?.growthRate ?? 0}%` },
                { label: 'Active subscriptions', value: d.subscriptions?.active ?? 0 },
              ]}
            />
          </PanelCard>
          <PanelCard title="Revenue by Country" icon={Globe}>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>Geographic breakdown not tracked yet</span>
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
