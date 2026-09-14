'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Send,
  Check,
  X,
  CreditCard,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PAYROLL_READ, PAYROLL_CREATE, PAYROLL_UPDATE, PAYROLL_DELETE, PAYROLL_APPROVE, PAYROLL_REJECT } from '@/lib/permissions';
import { getPayroll, getPayrollRecord, getPayrollStats, deletePayroll, submitPayroll, approvePayroll, rejectPayroll, markPayrollAsPaid, type PayrollRecord, type PayrollDetail, type PayrollStats, type PayrollResponse, type PayrollSortField, type PayrollStatus, type MarkAsPaidData } from '@/lib/api/payroll';
import { getEmployees, type EmployeeListResponse } from '@/lib/api/employees';
import { formatCurrency } from '@/lib/utils';
import { CreatePayrollDialog } from '@/components/payroll/create-payroll-dialog';
import { EditPayrollDialog } from '@/components/payroll/edit-payroll-dialog';
import { PayrollDetailsDialog } from '@/components/payroll/payroll-details-dialog';
import { useQuery as useEmpQuery } from '@tanstack/react-query';

const STATUS_CONFIG: Record<PayrollStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300' },
  PAID: { label: 'Paid', className: 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300' },
};

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
  const canApprove = isLoaded && hasPermission(PAYROLL_APPROVE);
  const canReject = isLoaded && hasPermission(PAYROLL_REJECT);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<PayrollSortField>('periodEnd');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<PayrollRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<PayrollDetail | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [submitTarget, setSubmitTarget] = useState<PayrollRecord | null>(null);
  const [approveTarget, setApproveTarget] = useState<PayrollRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PayrollRecord | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<PayrollRecord | null>(null);
  const [markPaidData, setMarkPaidData] = useState<MarkAsPaidData>({});

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
  }, [employeeFilter, periodStart, periodEnd, statusFilter]);

  const employeesQuery = useEmpQuery<EmployeeListResponse>({
    queryKey: ['employees', { isActive: true }],
    queryFn: () => getEmployees({ isActive: true, limit: 100 }),
    enabled: canRead,
  });

  const payrollQuery = useQuery<PayrollResponse>({
    queryKey: ['payroll', { search, employeeId: employeeFilter || undefined, periodStart: periodStart || undefined, periodEnd: periodEnd || undefined, page, limit: 20, sortBy, sortOrder }],
    queryFn: ({ signal }) => getPayroll({
      search: search || undefined,
      employeeId: employeeFilter || undefined,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
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

  function closeSubmitDialog() { setSubmitTarget(null); }
  function closeApproveDialog() { setApproveTarget(null); }
  function closeRejectDialog() { setRejectTarget(null); }
  function closeMarkPaidDialog() { setMarkPaidTarget(null); setMarkPaidData({}); }



  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: MarkAsPaidData }) => markPayrollAsPaid(id, data),
    onSuccess: () => {
      toast({ title: 'Payroll marked as paid' });
      invalidate();
      closeMarkPaidDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

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

  // Client-side status filtering (until backend supports it)
  const filteredPayroll = statusFilter ? payroll.filter((r) => r.status === statusFilter) : payroll;

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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name or code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            placeholder="Period Start"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            placeholder="Period End"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAID">Paid</option>
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
        ) : filteredPayroll.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
            <Wallet className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">No payroll records found</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {search || employeeFilter || periodStart || periodEnd || statusFilter ? 'Try adjusting your filters.' : canCreate ? 'Create your first payroll record to get started.' : 'Payroll records will appear here once created.'}
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
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('paymentDate')}>
                          Payment Date
                          <SortIcon field="paymentDate" sortBy={sortBy} sortOrder={sortOrder} />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayroll.map((record) => (
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
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[record.status].className}`}>
                            {STATUS_CONFIG[record.status].label}
                          </span>
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
                            {record.status === 'DRAFT' && canUpdate && (
                              <button
                                onClick={() => setEditRecord(record)}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {record.status === 'DRAFT' && canDelete && (
                              <button
                                onClick={() => setDeleteRecordTarget(record)}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:bg-red-500/10"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            {record.status === 'DRAFT' && canUpdate && (
                              <button
                                onClick={() => setSubmitTarget(record)}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                title="Submit"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )}
                            {record.status === 'PENDING' && canApprove && (
                              <button
                                onClick={() => setApproveTarget(record)}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-green-600 hover:bg-green-500/10"
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            {record.status === 'PENDING' && canReject && (
                              <button
                                onClick={() => setRejectTarget(record)}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:bg-red-500/10"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            {record.status === 'APPROVED' && canUpdate && (
                              <button
                                onClick={() => { setMarkPaidTarget(record); setMarkPaidData({}); }}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-blue-600 hover:bg-blue-500/10"
                                title="Mark as Paid"
                              >
                                <CreditCard className="h-4 w-4" />
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

      {/* Submit Confirmation Dialog */}
      <ConfirmDeleteDialog
        entityName={submitTarget ? `${submitTarget.employee.firstName} ${submitTarget.employee.lastName} (${new Date(submitTarget.periodStart).toLocaleDateString()} - ${new Date(submitTarget.periodEnd).toLocaleDateString()})` : null}
        title="Submit Payroll for Approval"
        description="This will submit the payroll record for manager review. You will not be able to edit or delete it after submission."
        buttonLabel="Submit"
        successTitle="Payroll submitted"
        errorFallback="Failed to submit payroll."
        open={submitTarget !== null}
        onClose={closeSubmitDialog}
        onDeleted={invalidate}
        deleteFn={() => submitTarget ? submitPayroll(submitTarget.id) : Promise.resolve()}
        buttonVariant="default"
        actionVerb="submit"
        pendingLabel="Submitting..."
      />

      {/* Approve Confirmation Dialog */}
      <ConfirmDeleteDialog
        entityName={approveTarget ? `${approveTarget.employee.firstName} ${approveTarget.employee.lastName} (${new Date(approveTarget.periodStart).toLocaleDateString()} - ${new Date(approveTarget.periodEnd).toLocaleDateString()})` : null}
        title="Approve Payroll"
        description="This will approve the payroll record. It can then be marked as paid."
        buttonLabel="Approve"
        successTitle="Payroll approved"
        errorFallback="Failed to approve payroll."
        open={approveTarget !== null}
        onClose={closeApproveDialog}
        onDeleted={invalidate}
        deleteFn={() => approveTarget ? approvePayroll(approveTarget.id) : Promise.resolve()}
        buttonVariant="default"
        actionVerb="approve"
        pendingLabel="Approving..."
      />

      {/* Reject Confirmation Dialog */}
      <ConfirmDeleteDialog
        entityName={rejectTarget ? `${rejectTarget.employee.firstName} ${rejectTarget.employee.lastName} (${new Date(rejectTarget.periodStart).toLocaleDateString()} - ${new Date(rejectTarget.periodEnd).toLocaleDateString()})` : null}
        title="Reject Payroll"
        description="This will reject the payroll record. This action cannot be undone."
        buttonLabel="Reject"
        successTitle="Payroll rejected"
        errorFallback="Failed to reject payroll."
        open={rejectTarget !== null}
        onClose={closeRejectDialog}
        onDeleted={invalidate}
        deleteFn={() => rejectTarget ? rejectPayroll(rejectTarget.id) : Promise.resolve()}
        buttonVariant="destructive"
        actionVerb="reject"
        pendingLabel="Rejecting..."
      />

      {/* Mark as Paid Dialog */}
      {markPaidTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Mark as Paid"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeMarkPaidDialog} />
          <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Mark as Paid</h2>
              <button onClick={closeMarkPaidDialog} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Mark payroll for <span className="font-medium text-foreground">{markPaidTarget.employee.firstName} {markPaidTarget.employee.lastName}</span> as paid.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Payment Date</label>
                <input
                  type="date"
                  value={markPaidData.paymentDate ?? ''}
                  onChange={(e) => setMarkPaidData({ ...markPaidData, paymentDate: e.target.value || undefined })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to use today's date.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                <Input
                  placeholder="Payment reference or notes..."
                  value={markPaidData.notes ?? ''}
                  onChange={(e) => setMarkPaidData({ ...markPaidData, notes: e.target.value || undefined })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={closeMarkPaidDialog}>
                Cancel
              </Button>
              <Button
                onClick={() => markPaidMutation.mutate({ id: markPaidTarget.id, data: markPaidData })}
                disabled={markPaidMutation.isPending}
              >
                {markPaidMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Marking as paid...
                  </>
                ) : (
                  'Mark as Paid'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
