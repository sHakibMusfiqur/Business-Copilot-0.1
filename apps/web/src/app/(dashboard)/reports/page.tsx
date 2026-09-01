'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, ShoppingCart, Package, Users, DollarSign } from 'lucide-react';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { RequirePermission } from '@/components/rbac/require-permission';
import { usePermissions } from '@/hooks/use-permissions';
import { REPORTS_READ } from '@/lib/permissions';
import { getReportsOverview, type ReportsOverview } from '@/lib/api/reports';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(REPORTS_READ);

  const overviewQuery = useQuery<ReportsOverview>({
    queryKey: ['reports', 'overview'],
    queryFn: () => getReportsOverview(),
    enabled: canRead,
  });

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View business analytics and summaries.</p>
        </div>
        <RequirePermission permission={REPORTS_READ}>
          <div />
        </RequirePermission>
      </div>
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">View business analytics and summaries.</p>
      </div>

      {overviewQuery.isLoading ? (
        <DashboardSkeleton />
      ) : overviewQuery.error ? (
        <DashboardError status={500} message={(overviewQuery.error as Error).message} />
      ) : !overview ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No report data available</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Report data will appear once you have transactions in the system.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-sm">Total Sales</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{overview.sales.totalOrders}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(overview.sales.totalRevenue)} revenue</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm">Total Purchases</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{overview.purchases.totalOrders}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(overview.purchases.totalCost)} cost</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">Employees</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{overview.employees.activeEmployees}</p>
              <p className="text-xs text-muted-foreground">{overview.employees.inactiveEmployees} inactive</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Net Position</span>
              </div>
              <p className="mt-2 text-2xl font-bold">
                {formatCurrency(overview.sales.totalRevenue - overview.purchases.totalCost)}
              </p>
              <p className="text-xs text-muted-foreground">Revenue - Cost</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Sales by Status</h3>
              <div className="mt-4 space-y-3">
                {overview.sales.byStatus.map((status) => (
                  <div key={status.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        status.status === 'DELIVERED' ? 'bg-emerald-500' :
                        status.status === 'CONFIRMED' ? 'bg-blue-500' :
                        status.status === 'PENDING' ? 'bg-amber-500' :
                        'bg-muted'
                      }`} />
                      <span className="text-sm">{status.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{status.count}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{formatCurrency(status.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Purchases by Status</h3>
              <div className="mt-4 space-y-3">
                {overview.purchases.byStatus.map((status) => (
                  <div key={status.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        status.status === 'RECEIVED' ? 'bg-emerald-500' :
                        status.status === 'APPROVED' ? 'bg-blue-500' :
                        status.status === 'PENDING' ? 'bg-amber-500' :
                        'bg-muted'
                      }`} />
                      <span className="text-sm">{status.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{status.count}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{formatCurrency(status.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Recent Hires</h3>
              <div className="mt-4 space-y-3">
                {overview.employees.recentHires.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent hires</p>
                ) : (
                  overview.employees.recentHires.map((hire) => (
                    <div key={hire.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{hire.firstName} {hire.lastName}</p>
                        <p className="text-xs text-muted-foreground">{hire.position ?? hire.employeeCode}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(hire.hireDate).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Employees by Department</h3>
              <div className="mt-4 space-y-3">
                {overview.employees.byDepartment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No department data</p>
                ) : (
                  overview.employees.byDepartment.map((dept) => (
                    <div key={dept.departmentId ?? 'none'} className="flex items-center justify-between">
                      <span className="text-sm">{dept.departmentId ?? 'Unassigned'}</span>
                      <span className="font-medium">{dept.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Report generated at: {new Date(overview.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
