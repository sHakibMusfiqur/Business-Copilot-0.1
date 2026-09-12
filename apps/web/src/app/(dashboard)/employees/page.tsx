'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { EmployeeTable } from '@/components/employees/employees-table';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { RequirePermission } from '@/components/rbac/require-permission';
import { usePermissions } from '@/hooks/use-permissions';
import { EMPLOYEES_READ, EMPLOYEES_CREATE, EMPLOYEES_UPDATE, EMPLOYEES_DELETE } from '@/lib/permissions';
import { getEmployees, deleteEmployee, type Employee, type EmployeeListResponse } from '@/lib/api/employees';
import { CreateEmployeeDialog } from '@/components/employees/create-employee-dialog';
import { EditEmployeeDialog } from '@/components/employees/edit-employee-dialog';

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(EMPLOYEES_READ);
  const canUpdate = isLoaded && hasPermission(EMPLOYEES_UPDATE);
  const canDelete = isLoaded && hasPermission(EMPLOYEES_DELETE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const limit = 50;

  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteEmployeeTarget, setDeleteEmployeeTarget] = useState<Employee | null>(null);

  const employeesQuery = useQuery<EmployeeListResponse>({
    queryKey: ['employees', { page, limit, search, sortBy, sortOrder, isActive: statusFilter }],
    queryFn: () => getEmployees({
      search: search || undefined,
      page,
      limit,
      sortBy,
      sortOrder,
      isActive: statusFilter,
    }),
    enabled: canRead,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  }, [queryClient]);

  const handleSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view employees. Contact your organization administrator."
      />
    );
  }

  if (employeesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (employeesQuery.isError) {
    return (
      <DashboardError
        message={employeesQuery.error instanceof Error ? employeesQuery.error.message : undefined}
        onRetry={() => employeesQuery.refetch()}
      />
    );
  }

  const employeesData = employeesQuery.data as EmployeeListResponse;
  const employees = employeesData.data;
  const meta = employeesData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization&apos;s employees
          </p>
        </div>
        <RequirePermission permission={EMPLOYEES_CREATE}>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Employee
          </button>
        </RequirePermission>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter === undefined ? '' : statusFilter ? 'active' : 'inactive'}
          onChange={(e) => {
            if (e.target.value === '') setStatusFilter(undefined);
            else setStatusFilter(e.target.value === 'active');
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <EmployeeTable
        employees={employees}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={employeesQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onEdit={canUpdate ? setEditEmployee : undefined}
        onDelete={canDelete ? setDeleteEmployeeTarget : undefined}
      />

      <CreateEmployeeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditEmployeeDialog
        employee={editEmployee}
        open={editEmployee !== null}
        onClose={() => setEditEmployee(null)}
        onUpdated={invalidate}
      />

      <ConfirmDeleteDialog
        entityName={deleteEmployeeTarget ? `${deleteEmployeeTarget.firstName} ${deleteEmployeeTarget.lastName}` : null}
        title="Delete Employee"
        description="This action cannot be undone. The employee record will be permanently removed."
        buttonLabel="Delete Employee"
        successTitle="Employee deleted"
        errorFallback="Failed to delete employee."
        open={deleteEmployeeTarget !== null}
        onClose={() => setDeleteEmployeeTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteEmployeeTarget ? deleteEmployee(deleteEmployeeTarget.id) : Promise.resolve()}
      />
    </div>
  );
}
