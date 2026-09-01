'use client';

import { useQuery } from '@tanstack/react-query';
import { Wallet, Calendar, DollarSign, TrendingUp } from 'lucide-react';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { RequirePermission } from '@/components/rbac/require-permission';
import { usePermissions } from '@/hooks/use-permissions';
import { PAYROLL_READ } from '@/lib/permissions';
import { getPayroll, getPayrollStats, type PayrollRecord, type PayrollStats } from '@/lib/api/payroll';
import { formatCurrency } from '@/lib/utils';

export default function PayrollPage() {
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(PAYROLL_READ);

  const payrollQuery = useQuery<PayrollRecord[]>({
    queryKey: ['payroll'],
    queryFn: () => getPayroll(),
    enabled: canRead,
  });

  const statsQuery = useQuery<PayrollStats>({
    queryKey: ['payroll', 'stats'],
    queryFn: () => getPayrollStats(),
    enabled: canRead,
  });

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">Manage employee payroll and compensation.</p>
        </div>
        <RequirePermission permission={PAYROLL_READ}>
          <div />
        </RequirePermission>
      </div>
    );
  }

  const payroll = payrollQuery.data ?? [];
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground">Manage employee payroll and compensation.</p>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Total Records</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Total Net Salary</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(stats.totalNetSalary)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Total Allowances</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(stats.totalAllowances)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Total Tax</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(stats.totalTax)}</p>
          </div>
        </div>
      )}

      {payrollQuery.isLoading ? (
        <DashboardSkeleton />
      ) : payrollQuery.error ? (
        <DashboardError status={500} message={(payrollQuery.error as Error).message} />
      ) : payroll.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
          <Wallet className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No payroll records found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Payroll records will appear here once created.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Basic Salary</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Allowances</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Deductions</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tax</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Salary</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map((record) => (
                  <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{record.employee.firstName} {record.employee.lastName}</p>
                        <p className="text-xs text-muted-foreground">{record.employee.employeeCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(record.periodStart).toLocaleDateString()} - {new Date(record.periodEnd).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(record.basicSalary))}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(Number(record.allowances))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                      -{formatCurrency(Number(record.deductions))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                      -{formatCurrency(Number(record.tax))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatCurrency(Number(record.netSalary))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {record.paymentDate ? new Date(record.paymentDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
