'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  Trophy,
  XCircle,
  CalendarClock,
  Target,
  Activity as ActivityIcon,
} from 'lucide-react';

import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { RevenueTrendChart, FunnelBars } from '@/components/crm/crm-charts';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_READ } from '@/lib/permissions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getCrmDashboard, getOrganizationUsers } from '@/lib/api';
import type { CrmDashboard } from '@/lib/api';

type RangePreset = '30d' | '90d' | '6m' | '12m' | 'ytd';

const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'This year' },
];

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset: RangePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  switch (preset) {
    case '30d':
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case '90d':
      start.setUTCDate(start.getUTCDate() - 90);
      break;
    case '6m':
      start.setUTCMonth(start.getUTCMonth() - 6);
      break;
    case '12m':
      start.setUTCMonth(start.getUTCMonth() - 12);
      break;
    case 'ytd':
      start.setUTCMonth(0);
      start.setUTCDate(1);
      break;
  }

  return { startDate: isoDay(start), endDate: isoDay(end) };
}

interface KpiCardProps {
  icon: typeof DollarSign;
  iconClassName?: string;
  label: string;
  value: string;
  hint?: string;
}

function KpiCard({ icon: Icon, iconClassName = 'text-primary', label, value, hint }: KpiCardProps) {
  return (
    <DashboardCard>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="rounded-lg bg-muted p-2">
          <Icon className={`h-4 w-4 ${iconClassName}`} aria-hidden="true" />
        </div>
      </div>
    </DashboardCard>
  );
}

export default function CrmDashboardPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const canRead = isLoaded && hasPermission(CRM_READ);

  const [preset, setPreset] = useState<RangePreset>('12m');
  const [ownerId, setOwnerId] = useState('');

  const range = useMemo(() => rangeForPreset(preset), [preset]);

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: canRead,
  });

  const dashboardQuery = useQuery<CrmDashboard>({
    queryKey: ['crm', 'dashboard', { ...range, ownerId }],
    queryFn: ({ signal }) =>
      getCrmDashboard({ startDate: range.startDate, endDate: range.endDate, ownerId: ownerId || undefined }, signal),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view the CRM dashboard. Contact your organization administrator."
      />
    );
  }

  if (dashboardQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (dashboardQuery.isError) {
    return (
      <DashboardError
        message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : undefined}
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  const dashboard = dashboardQuery.data as CrmDashboard;
  const { kpis, funnel, revenueTrend, range: servedRange } = dashboard;
  const users = usersQuery.data ?? [];
  const targetPercent = kpis.targetAchievement;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(servedRange.startDate)} – {formatDate(servedRange.endDate)}
            {ownerId ? ` · filtered by owner` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="crm-range-preset">
            Date range
          </label>
          <select
            id="crm-range-preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value as RangePreset)}
            className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="crm-owner-filter">
            Owner
          </label>
          <select
            id="crm-owner-filter"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="flex h-10 max-w-[200px] rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">All owners</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon={DollarSign}
          label="Revenue (won)"
          value={formatCurrency(kpis.revenue)}
          hint={`${kpis.wonCount} won · ${kpis.lostCount} lost`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Open Pipeline"
          value={formatCurrency(kpis.openPipelineValue)}
          hint={`${kpis.openDealCount} open deals · ${formatCurrency(kpis.weightedPipeline)} weighted`}
        />
        <KpiCard
          icon={Trophy}
          iconClassName="text-emerald-600"
          label="Win Rate"
          value={`${kpis.conversionRate}%`}
          hint={`${kpis.wonCount} of ${kpis.wonCount + kpis.lostCount} closed deals`}
        />
        <KpiCard
          icon={CalendarClock}
          label="Sales Cycle"
          value={`${kpis.averageSalesCycleDays} days`}
          hint={`median ${kpis.medianSalesCycleDays} days · n=${kpis.salesCycleSampleSize}`}
        />
        <KpiCard
          icon={ActivityIcon}
          label="New Records"
          value={`${kpis.newLeadCount} leads`}
          hint={`${kpis.newContactCount} contacts · ${kpis.newDealCount} deals`}
        />
        <DashboardCard>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Target Achievement
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight">
                {targetPercent === null ? '—' : `${targetPercent}%`}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {kpis.targetAmount > 0
                  ? `${formatCurrency(kpis.revenue)} of ${formatCurrency(kpis.targetAmount)} target`
                  : 'No sales targets set for this period'}
              </p>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary/75"
                  style={{ width: `${Math.min(targetPercent ?? 0, 100)}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <Target className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard className="lg:col-span-2 min-w-0">
          <h2 className="mb-4 text-sm font-medium">Revenue Trend</h2>
          <RevenueTrendChart trend={revenueTrend} />
        </DashboardCard>

        <DashboardCard className="min-w-0">
          <h2 className="mb-4 text-sm font-medium">Stage Funnel</h2>
          <FunnelBars stages={funnel} />
        </DashboardCard>
      </div>

      <DashboardCard>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            Metrics cover the selected range and owner filter. Deals are counted as won when moved into a won
            stage; revenue sums their values.
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}
