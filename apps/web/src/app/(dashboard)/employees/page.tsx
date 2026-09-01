'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { EMPLOYEES_READ, EMPLOYEES_CREATE, EMPLOYEES_UPDATE, EMPLOYEES_DELETE } from '@/lib/permissions';
import { getEmployees, deleteEmployee, type Employee, type EmployeesResponse } from '@/lib/api/employees';
import { CreateEmployeeDialog } from '@/components/employees/create-employee-dialog';
import { EditEmployeeDialog } from '@/components/employees/edit-employee-dialog';

export default function EmployeesPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const queryClient = useQueryClient();

  const canRead = isLoaded && hasPermission(EMPLOYEES_READ);
  const canCreate = isLoaded && hasPermission(EMPLOYEES_CREATE);
  const canUpdate = isLoaded && hasPermission(EMPLOYEES_UPDATE);
  const canDelete = isLoaded && hasPermission(EMPLOYEES_DELETE);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteEmployeeTarget, setDeleteEmployeeTarget] = useState<Employee | null>(null);

  const employeesQuery = useQuery<EmployeesResponse>({
    queryKey: ['employees', { search, isActive: statusFilter }],
    queryFn: () => getEmployees({
      search: search || undefined,
      isActive: statusFilter,
    }),
    enabled: canRead,
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  }

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

  const employees = employeesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">Manage your organization&apos;s employees.</p>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
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

      {employeesQuery.isLoading ? (
        <DashboardSkeleton />
      ) : employeesQuery.error ? (
        <DashboardError status={500} message={(employeesQuery.error as Error).message} />
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No employees found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {search ? 'Try adjusting your search criteria.' : 'Add your first employee to get started.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Position</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hire Date</th>
                  {(canUpdate || canDelete) && (
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{employee.employeeCode}</td>
                    <td className="px-4 py-3">
                      {employee.department ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                          <Building2 className="h-3 w-3" />
                          {employee.department.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{employee.position ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        employee.isActive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(employee.hireDate).toLocaleDateString()}
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditEmployee(employee)}
                            >
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteEmployeeTarget(employee)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
