'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trophy, BarChart3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { RequirePermission } from '@/components/rbac/require-permission';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RevenueTrendChart, FunnelBars } from '@/components/crm/crm-charts';
import { SalesTargetDialog } from '@/components/crm/sales-target-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import {
  CRM_READ,
  CRM_REPORTS,
  CRM_CREATE,
  CRM_UPDATE,
  CRM_DELETE,
} from '@/lib/permissions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getCrmReports, getSalesTargets, deleteSalesTarget, getOrganizationUsers } from '@/lib/api';
import type { CrmReports, SalesTarget } from '@/lib/api';

type RangePreset = '30d' | '90d' | '6m' | '12m' | 'ytd';
type Granularity = 'day' | 'week' | 'month';

const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'This year' },
];

const GRANULARITIES: Array<{ value: Granularity; label: string }> = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset: RangePreset): { startDate: string; endDate: string } {
  const now = new Date();
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

  return { startDate: isoDay(start), endDate: isoDay(now) };
}

function TargetProgressBar({ achievement }: { achievement: number }) {
  const width = Math.min(Math.max(achievement, 0), 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div
        className={`h-full rounded-full ${achievement >= 100 ? 'bg-emerald-500' : 'bg-primary/75'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function CrmReportsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canView = isLoaded && hasPermission(CRM_REPORTS);
  const canReadTargets = isLoaded && hasPermission(CRM_READ);
  const canCreateTarget = isLoaded && hasPermission(CRM_CREATE);
  const canUpdateTarget = isLoaded && hasPermission(CRM_UPDATE);
  const canDeleteTarget = isLoaded && hasPermission(CRM_DELETE);

  const [preset, setPreset] = useState<RangePreset>('12m');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [ownerId, setOwnerId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SalesTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalesTarget | null>(null);

  const range = useMemo(() => rangeForPreset(preset), [preset]);

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: canView,
  });

  const reportsQuery = useQuery<CrmReports>({
    queryKey: ['crm', 'reports', { ...range, ownerId, granularity }],
    queryFn: ({ signal }) =>
      getCrmReports(
        {
          startDate: range.startDate,
          endDate: range.endDate,
          ownerId: ownerId || undefined,
          granularity,
        },
        signal,
      ),
    enabled: canView,
  });

  const targetsQuery = useQuery({
    queryKey: ['crm', 'sales-targets', { from: range.startDate, to: range.endDate }],
    queryFn: ({ signal }) => getSalesTargets({ from: range.startDate, to: range.endDate }, signal),
    enabled: canView && canReadTargets,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['crm', 'reports'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'sales-targets'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  if (!canView) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view CRM reports. Contact your organization administrator."
      />
    );
  }

  if (reportsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (reportsQuery.isError) {
    return (
      <DashboardError
        message={reportsQuery.error instanceof Error ? reportsQuery.error.message : undefined}
        onRetry={() => reportsQuery.refetch()}
      />
    );
  }

  const reports = reportsQuery.data as CrmReports;
  const users = usersQuery.data ?? [];
  const targets = targetsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(reports.range.startDate)} – {formatDate(reports.range.endDate)} ·{' '}
            {GRANULARITIES.find((g) => g.value === reports.granularity)?.label ?? reports.granularity} buckets
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="report-range-preset">
            Date range
          </label>
          <select
            id="report-range-preset"
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

          <label className="sr-only" htmlFor="report-granularity">
            Granularity
          </label>
          <select
            id="report-granularity"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {GRANULARITIES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="report-owner-filter">
            Owner
          </label>
          <select
            id="report-owner-filter"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="flex h-10 max-w-[190px] rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revenue</p>
          <p className="mt-1.5 text-2xl font-semibold">{formatCurrency(reports.kpis.revenue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {reports.kpis.wonCount} won · {reports.kpis.lostCount} lost
          </p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Win Rate</p>
          <p className="mt-1.5 text-2xl font-semibold">{reports.kpis.conversionRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {reports.kpis.wonCount + reports.kpis.lostCount} closed deals
          </p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open Pipeline</p>
          <p className="mt-1.5 text-2xl font-semibold">{formatCurrency(reports.kpis.openPipelineValue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(reports.kpis.weightedPipeline)} weighted
          </p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sales Cycle</p>
          <p className="mt-1.5 text-2xl font-semibold">{reports.kpis.averageSalesCycleDays} days</p>
          <p className="mt-1 text-xs text-muted-foreground">
            median {reports.kpis.medianSalesCycleDays} · n={reports.kpis.salesCycleSampleSize}
          </p>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium">Revenue Trend</h2>
          <RevenueTrendChart trend={reports.revenueTrend} />
        </DashboardCard>
        <DashboardCard>
          <h2 className="mb-4 text-sm font-medium">Stage Funnel</h2>
          <FunnelBars stages={reports.funnel} />
        </DashboardCard>
      </div>

      <DashboardCard>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Trophy className="h-4 w-4 text-muted-foreground" /> Leaderboard
        </h2>
        {reports.leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No owner activity in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                  <th className="p-3 text-right text-sm font-medium text-muted-foreground">Won Revenue</th>
                  <th className="p-3 text-right text-sm font-medium text-muted-foreground">Won</th>
                  <th className="p-3 text-right text-sm font-medium text-muted-foreground">Open Value</th>
                  <th className="p-3 text-right text-sm font-medium text-muted-foreground">Open</th>
                </tr>
              </thead>
              <tbody>
                {reports.leaderboard.map((row) => (
                  <tr key={row.ownerId} className="border-b last:border-b-0">
                    <td className="p-3">
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </td>
                    <td className="p-3 text-right text-sm font-medium">{formatCurrency(row.wonRevenue)}</td>
                    <td className="p-3 text-right text-sm">{row.wonCount}</td>
                    <td className="p-3 text-right text-sm">{formatCurrency(row.openValue)}</td>
                    <td className="p-3 text-right text-sm">{row.openCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      <DashboardCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Sales Targets
          </h2>
          {canCreateTarget && (
            <RequirePermission permission={CRM_CREATE}>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Target
              </Button>
            </RequirePermission>
          )}
        </div>

        {!canReadTargets ? (
          <p className="text-sm text-muted-foreground">
            You need the sales target read permission to view targets.
          </p>
        ) : targetsQuery.isLoading ? (
          <div className="space-y-2">
            <div className="h-8 animate-pulse rounded bg-muted" />
            <div className="h-8 animate-pulse rounded bg-muted" />
          </div>
        ) : targetsQuery.isError ? (
          <p className="text-sm text-destructive">
            Failed to load sales targets:{' '}
            {targetsQuery.error instanceof Error ? targetsQuery.error.message : 'unknown error'}
          </p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sales targets overlap the selected period. Create one to track achievement against won revenue.
          </p>
        ) : (
          <div className="space-y-4">
            {targets.map((target) => (
              <div key={target.id} className="rounded-lg border p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {target.owner?.name ?? 'Organization-wide'}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatDate(target.periodStart)} – {formatDate(target.periodEnd)}
                      </span>
                    </p>
                    {target.notes && <p className="mt-0.5 text-xs text-muted-foreground">{target.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(target.achieved)} / {formatCurrency(target.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {target.achievement}% · {target.wonCount} won
                      </p>
                    </div>
                    {canUpdateTarget && (
                      <Button variant="outline" size="sm" onClick={() => setEditTarget(target)}>
                        Edit
                      </Button>
                    )}
                    {canDeleteTarget && (
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(target)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                <TargetProgressBar achievement={target.achievement} />
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      <SalesTargetDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={invalidate} />
      <SalesTargetDialog
        open={editTarget !== null}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={invalidate}
      />
      <ConfirmDeleteDialog
        entityName={deleteTarget ? `target for ${deleteTarget.owner?.name ?? 'organization'}` : null}
        title="Delete Sales Target"
        description="This will permanently remove this sales target. This action cannot be undone."
        buttonLabel="Delete Target"
        successTitle="Target deleted"
        errorFallback="Failed to delete sales target."
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteSalesTarget(deleteTarget?.id ?? '')}
      />
    </div>
  );
}
