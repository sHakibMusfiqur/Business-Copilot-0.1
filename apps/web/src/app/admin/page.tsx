'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CalendarRange,
  CreditCard,
  FlaskConical,
  HardDrive,
  HeartPulse,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

import {
  getAdminDashboard,
  getAdminOrganizations,
  type DashboardResponse,
  type OrganizationListResponse,
} from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { AdminButton } from '@/components/admin/admin-button';
import { ActivityList } from '@/components/admin/activity-list';
import { AreaChart, BarChart, DonutChart } from '@/components/admin/charts';
import { KpiCard } from '@/components/admin/kpi-card';
import { MetricList } from '@/components/admin/metric-list';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { ErrorState, LoadingState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';
import type { KpiMetric } from '@/components/admin/types';

export default function PlatformDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => getAdminDashboard(),
    staleTime: 30_000,
  });

  const orgsQuery = useQuery({
    queryKey: ['admin', 'organizations', 'latest'],
    queryFn: () => getAdminOrganizations(1, 5),
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <LoadingState rows={2} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Could not load platform dashboard" onRetry={() => refetch()} />;
  }

  const d = data as DashboardResponse;
  const monthlyRevenue = d.revenue?.thisMonth ?? 0;
  const orgTrend = [d.organizations?.newToday ?? 0, d.organizations?.newThisWeek ?? 0, d.organizations?.newThisMonth ?? 0];
  const revenueTrend = [d.revenue?.today ?? 0, d.revenue?.thisMonth ?? 0, d.revenue?.lifetime ?? 0];

  const kpis: KpiMetric[] = [
    { key: 'total-orgs', label: 'Total Organizations', value: d.organizations?.total ?? 0, icon: Building2, tone: 'info', hint: `${d.organizations?.newThisMonth ?? 0} created this month` },
    { key: 'active-orgs', label: 'Active Organizations', value: d.organizations?.active ?? 0, icon: ShieldCheck, tone: 'success' },
    { key: 'trial-orgs', label: 'Trial Organizations', value: d.subscriptions?.trialing ?? 0, icon: FlaskConical, tone: 'warning' },
    { key: 'paid-orgs', label: 'Paid Organizations', value: d.subscriptions?.active ?? 0, icon: CreditCard, tone: 'violet' },
    { key: 'mrr', label: 'MRR (this month)', value: monthlyRevenue, isCurrency: true, icon: TrendingUp, tone: 'success' },
    { key: 'arr', label: 'ARR (annualized)', value: monthlyRevenue * 12, isCurrency: true, icon: CalendarRange, tone: 'violet' },
    { key: 'monthly-rev', label: 'Monthly Revenue', value: monthlyRevenue, isCurrency: true, icon: Wallet, tone: 'info' },
    { key: 'lifetime-rev', label: 'Lifetime Revenue', value: d.revenue?.lifetime ?? 0, isCurrency: true, icon: CreditCard, tone: 'neutral', hint: 'All-time paid invoices' },
    { key: 'users', label: 'Total Platform Users', value: d.users?.total ?? 0, icon: Users, tone: 'info', hint: `${d.users?.growthRate ?? 0}% MoM growth` },
    { key: 'online', label: 'Online Users', value: d.users?.dailyActive ?? 0, icon: Activity, tone: 'success', hint: 'Active today' },
    { key: 'ai-today', label: 'AI Requests Today', value: 0, icon: Bot, tone: 'neutral', hint: 'Not tracked yet' },
    { key: 'storage', label: 'Storage Usage', value: 0, suffix: ' MB', icon: HardDrive, tone: 'neutral', hint: 'Not tracked yet' },
  ];

  const planDistribution = (d.subscriptions?.topPlans ?? []).map((p, i) => ({
    label: p.name,
    value: p.count,
    color: ['hsl(var(--primary))', 'hsl(var(--brand-accent))', 'hsl(var(--brand-secondary))', '#F59E0B', '#8B5CF6'][i % 5],
  }));

  const subscriptionDist = [
    { label: 'Trial', value: d.subscriptions?.trialing ?? 0, color: '#F59E0B' },
    { label: 'Active', value: d.subscriptions?.active ?? 0, color: '#10B981' },
    { label: 'Expired', value: d.subscriptions?.expired ?? 0, color: '#94A3B8' },
    { label: 'Cancelled', value: d.subscriptions?.cancelled ?? 0, color: '#EF4444' },
  ];

  const recentOrgs = (orgsQuery.data?.data ?? []) as OrganizationListResponse[];
  const uptimeHours = Math.round((d.platform?.uptimeMs ?? 0) / 3600000);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Overview"
        description="Monitor the entire Business Copilot SaaS platform"
        actions={
          <>
            <StatusBadge label="Operational" tone="success" dot />
            <Link href="/admin/monitoring">
              <AdminButton variant="outline">
                System Monitoring <ArrowRight className="h-3.5 w-3.5" />
              </AdminButton>
            </Link>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {kpis.map((metric) => (
          <KpiCard key={metric.key} metric={metric} />
        ))}
      </div>

      {/* Server health strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <PanelCard padded={false} className="flex items-center gap-3 p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <HeartPulse className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">Server Health</p>
            <p className="text-[11px] text-muted-foreground">All systems operational</p>
          </div>
        </PanelCard>
        <PanelCard padded={false} className="flex items-center gap-3 p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">Uptime</p>
            <p className="text-[11px] text-muted-foreground">{uptimeHours} hours since last restart</p>
          </div>
        </PanelCard>
        <PanelCard padded={false} className="flex items-center gap-3 p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">Platform Version</p>
            <p className="text-[11px] text-muted-foreground">v{d.platform?.version ?? '0.1.0'}</p>
          </div>
        </PanelCard>
      </div>

      {/* Growth charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <PanelCard title="Revenue Growth" description="Today · This month · Lifetime">
          <AreaChart
            data={revenueTrend}
            labels={['Today', 'This month', 'Lifetime']}
            color="hsl(var(--primary))"
            height={180}
          />
        </PanelCard>
        <PanelCard title="Organization Growth" description="New organizations (day · week · month)">
          <AreaChart
            data={orgTrend}
            labels={['Today', 'This week', 'This month']}
            color="hsl(var(--brand-accent))"
            height={180}
          />
        </PanelCard>
        <PanelCard title="User Activity" description="Active platform users">
          <AreaChart
            data={[d.users?.monthlyActive ?? 0, d.users?.dailyActive ?? 0, d.users?.total ?? 0]}
            labels={['Monthly active', 'Daily active', 'Total']}
            color="hsl(var(--brand-secondary))"
            height={180}
          />
        </PanelCard>
      </div>

      {/* Distribution */}
      <div className="grid gap-3 lg:grid-cols-3">
        <PanelCard title="Subscription Distribution" description="By status">
          <DonutChart data={subscriptionDist} centerLabel="Total" centerValue={String(d.subscriptions ? d.subscriptions.trialing + d.subscriptions.active + d.subscriptions.expired + d.subscriptions.cancelled : 0)} height={190} />
        </PanelCard>
        <PanelCard title="Plan Distribution" description="Top plans by subscription count">
          {planDistribution.length > 0 ? (
            <BarChart data={planDistribution} height={190} />
          ) : (
            <div className="py-10 text-center text-[13px] text-muted-foreground">No subscription data yet</div>
          )}
        </PanelCard>
        <div className="space-y-3">
          <PanelCard title="Payment Trend" description="Paid invoice revenue">
            <BarChart
              data={[
                { label: 'Today', value: d.revenue?.today ?? 0 },
                { label: 'Month', value: d.revenue?.thisMonth ?? 0 },
              ]}
              height={70}
            />
          </PanelCard>
          <PanelCard title="AI Usage" description="Token consumption pipeline not yet active">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Bot className="h-4 w-4" />
              <span>No AI traffic recorded</span>
            </div>
          </PanelCard>
        </div>
      </div>

      {/* Activity */}
      <div className="grid gap-3 lg:grid-cols-3">
        <PanelCard title="Latest Organizations" description="Most recently created workspaces">
          <ActivityList
            items={(recentOrgs.length > 0 ? recentOrgs : []).map((org) => ({
              id: org.id,
              title: org.name,
              description: org.owner ? `Owner: ${org.owner.name}` : 'No owner assigned',
              meta: org.plan?.name ? `Plan: ${org.plan.name}` : undefined,
              icon: Building2,
              tone: 'info',
              timestamp: org.createdAt,
            }))}
          />
        </PanelCard>
        <PanelCard title="Recent Activity" description="Audit events recorded today">
          {d.recentActivities?.length ? (
            <ActivityList
              limit={6}
              items={d.recentActivities.map((a) => ({
                id: a.id,
                title: a.action,
                description: a.user ? `${a.user.name} (${a.user.email})` : 'System',
                icon: Activity,
                tone: 'neutral',
                timestamp: a.createdAt,
              }))}
            />
          ) : (
            <div className="py-10 text-center text-[13px] text-muted-foreground">No activity recorded today</div>
          )}
        </PanelCard>
        <PanelCard title="Top Organizations" description="By employee count">
          <MetricList
            items={(d.topOrganizations ?? []).map((o, i) => ({
              label: `${i + 1}. ${o.name}`,
              hint: `${o.userCount} employees`,
              value: formatCurrency(o.revenue),
            }))}
          />
        </PanelCard>
      </div>

      {/* Alerts */}
      {(d.recentErrors?.length ?? 0) > 0 && (
        <PanelCard title="Failed Events" description="Latest failures today" className={cn('border-red-500/30')}>
          <ActivityList
            limit={5}
            items={(d.recentErrors ?? []).map((e) => ({
              id: e.id,
              title: e.action,
              description: e.user ? `${e.user.name} (${e.user.email})` : 'System',
              icon: AlertTriangle,
              tone: 'danger',
              timestamp: e.createdAt,
            }))}
          />
        </PanelCard>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Sign-ups" description="New users joining the platform">
          <ActivityList
            items={(recentOrgs.length > 0 ? recentOrgs : []).map((org) => ({
              id: `signup-${org.id}`,
              title: org.name,
              description: 'Organization registered',
              icon: UserPlus,
              tone: 'success',
              timestamp: org.createdAt,
            }))}
          />
        </PanelCard>
        <PanelCard title="Subscription Status" description="Across all workspaces">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trial', value: d.subscriptions?.trialing ?? 0, tone: 'warning' as const },
              { label: 'Active', value: d.subscriptions?.active ?? 0, tone: 'success' as const },
              { label: 'Expired', value: d.subscriptions?.expired ?? 0, tone: 'neutral' as const },
              { label: 'Cancelled', value: d.subscriptions?.cancelled ?? 0, tone: 'danger' as const },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
