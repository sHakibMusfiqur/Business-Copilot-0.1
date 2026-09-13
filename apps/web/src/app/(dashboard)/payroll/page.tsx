'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Wallet,
  DollarSign,
  TrendingUp,
  Calendar,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PAYROLL_READ, PAYROLL_CREATE, PAYROLL_UPDATE, PAYROLL_DELETE } from '@/lib/permissions';
import { getPayroll, getPayrollRecord, getPayrollStats, deletePayroll, type PayrollRecord, type PayrollDetail, type PayrollStats, type PayrollResponse, type PayrollSortField } from '@/lib/api/payroll';
import { getEmployees, type EmployeeListResponse } from '@/lib/api/employees';
import { formatCurrency } from '@/lib/utils';
import { CreatePayrollDialog } from '@/components/payroll/create-payroll-dialog';
import { EditPayrollDialog } from '@/components/payroll/edit-payroll-dialog';
import { PayrollDetailsDialog } from '@/components/payroll/payroll-details-dialog';
import { useQuery as useEmpQuery } from '@tanstack/react-query';

function SortIcon({ field, sortBy, sortOrder }: { field: string; sortBy: string; sortOrder: string }) {
  if (field !== sortBy) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
  return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
}

export default function PayrollPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canRead = isLoaded && hasPermission(PAYROLL_READ);
  const canCreate = isLoaded && hasPermission(PAYROLL_CREATE);
  const canUpdate = isLoaded && hasPermission(PAYROLL_UPDATE);
  const canDelete = isLoaded && hasPermission(PAYROLL_DELETE);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<PayrollSortField>('periodEnd');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<PayrollRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<PayrollDetail | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [employeeFilter]);

  const employeesQuery = useEmpQuery<EmployeeListResponse>({
    queryKey: ['employees', { isActive: true }],
    queryFn: () => getEmployees({ isActive: true, limit: 100 }),
    enabled: canRead,
  });

  const payrollQuery = useQuery<PayrollResponse>({
    queryKey: ['payroll', { search, employeeId: employeeFilter || undefined, page, limit: 20, sortBy, sortOrder }],
    queryFn: ({ signal }) => getPayroll({
      search: search || undefined,
      employeeId: employeeFilter || undefined,
      page,
      limit: 20,
      sortBy,
      sortOrder,
    }, signal),
    enabled: canRead,
  });

  const statsQuery = useQuery<PayrollStats>({
    queryKey: ['payroll', 'stats'],
    queryFn: () => getPayrollStats(),
    enabled: canRead,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['payroll'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  }

  async function handleViewDetail(record: PayrollRecord) {
    try {
      const detail = await getPayrollRecord(record.id);
      setViewRecord(detail);
      setViewOpen(true);
    } catch {
      toast({ title: 'Failed to load details', variant: 'destructive' });
    }
  }

  function handleSort(field: PayrollSortField) {
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  }

  if (!isLoaded) return <DashboardSkeleton />;

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view payroll records. Contact your organization administrator."
      />
    );
  }

  const payroll = payrollQuery.data?.data ?? [];
  const meta = payrollQuery.data?.meta ?? null;
  const employees = (employeesQuery.data as EmployeeListResponse | undefined)?.data ?? [];
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">Manage employee payroll and compensation.</p>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add Record
          </Button>
        )}
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

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name or code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
        </div>

        {payrollQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="h-10 w-24 bg-muted animate-pulse rounded" />
                <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded flex-1" />
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : payrollQuery.error ? (
          <DashboardError status={500} message={(payrollQuery.error as Error).message} />
        ) : payroll.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
            <Wallet className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">No payroll records found</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {search || employeeFilter ? 'Try adjusting your filters.' : canCreate ? 'Create your first payroll record to get started.' : 'Payroll records will appear here once created.'}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('periodStart')}>
                          Period
                          <SortIcon field="periodStart" sortBy={sortBy} sortOrder={sortOrder} />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('basicSalary')}>
                          Basic Salary
                          <SortIcon field="basicSalary" sortBy={sortBy} sortOrder={sortOrder} />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('allowances')}>
                          Allowances
                          <SortIcon field="allowances" sortBy={sortBy} sortOrder={sortOrder} />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('deductions')}>
                          Deductions
                          <SortIcon field="deductions" sortBy={sortBy} sortOrder={sortOrder} />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('tax')}>
                          Tax
                          <SortIcon field="tax" sortBy={sortBy} sortOrder={sortOrder} />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('netSalary')}>
                          Net Salary
                          <SortIcon field="netSalary" sortBy={sortBy} sortOrder={sortOrder} />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment Date</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleViewDetail(record)}
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {canUpdate && (
                              <button
                                onClick={() => setEditRecord(record)}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDeleteRecordTarget(record)}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:bg-red-500/10"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages} ({meta.total} total)
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => setPage(1)}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">{meta.page} / {meta.totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.totalPages)}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreatePayrollDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditPayrollDialog
        record={editRecord}
        open={editRecord !== null}
        onClose={() => setEditRecord(null)}
        onUpdated={invalidate}
      />

      <PayrollDetailsDialog
        record={viewRecord}
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewRecord(null); }}
      />

      <ConfirmDeleteDialog
        entityName={deleteRecordTarget ? `${deleteRecordTarget.employee.firstName} ${deleteRecordTarget.employee.lastName} (${new Date(deleteRecordTarget.periodStart).toLocaleDateString()} - ${new Date(deleteRecordTarget.periodEnd).toLocaleDateString()})` : null}
        title="Delete Payroll Record"
        description="This action cannot be undone. The payroll record will be permanently removed."
        buttonLabel="Delete Record"
        successTitle="Payroll record deleted"
        errorFallback="Failed to delete payroll record."
        open={deleteRecordTarget !== null}
        onClose={() => setDeleteRecordTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteRecordTarget ? deletePayroll(deleteRecordTarget.id) : Promise.resolve()}
      />
    </div>
  );
}
