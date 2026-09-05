'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search, CalendarDays } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { EMPLOYEES_READ, EMPLOYEES_CREATE, EMPLOYEES_UPDATE, EMPLOYEES_DELETE, EMPLOYEES_APPROVE, EMPLOYEES_REJECT } from '@/lib/permissions';
import { getLeaves, deleteLeave, approveLeave, rejectLeave, type Leave, type LeavesResponse } from '@/lib/api/leaves';
import { useToast } from '@/components/ui/use-toast';
import { LeaveTable } from '@/components/leaves/leave-table';
import { CreateLeaveDialog } from '@/components/leaves/create-leave-dialog';
import { EditLeaveDialog } from '@/components/leaves/edit-leave-dialog';
import { LeaveDetailsDialog } from '@/components/leaves/leave-details-dialog';

export default function LeavesPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canRead = isLoaded && hasPermission(EMPLOYEES_READ);
  const canCreate = isLoaded && hasPermission(EMPLOYEES_CREATE);
  const canUpdate = isLoaded && hasPermission(EMPLOYEES_UPDATE);
  const canDelete = isLoaded && hasPermission(EMPLOYEES_DELETE);
  const canApprove = isLoaded && hasPermission(EMPLOYEES_APPROVE);
  const canReject = isLoaded && hasPermission(EMPLOYEES_REJECT);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editLeave, setEditLeave] = useState<Leave | null>(null);
  const [viewLeave, setViewLeave] = useState<Leave | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Leave | null>(null);

  const leavesQuery = useQuery<LeavesResponse>({
    queryKey: ['leaves', { status: statusFilter, type: typeFilter }],
    queryFn: () => getLeaves({
      status: statusFilter || undefined,
      type: typeFilter || undefined,
    }),
    enabled: canRead,
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['leaves'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveLeave(id),
    onSuccess: () => {
      toast({ title: 'Leave approved', description: 'The leave request has been approved.' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to approve', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectLeave(id),
    onSuccess: () => {
      toast({ title: 'Leave rejected', description: 'The leave request has been rejected.' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reject', description: error.message, variant: 'destructive' });
    },
  });

  if (!isLoaded) return <DashboardSkeleton />;

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view leave requests. Contact your organization administrator."
      />
    );
  }

  const leaves = (leavesQuery.data ?? []).filter((leave) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      leave.employee.firstName.toLowerCase().includes(q) ||
      leave.employee.lastName.toLowerCase().includes(q) ||
      leave.employee.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">Manage employee leave requests and approvals.</p>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Leave Request
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Types</option>
          <option value="ANNUAL">Annual</option>
          <option value="SICK">Sick</option>
          <option value="PERSONAL">Personal</option>
          <option value="MATERNITY">Maternity</option>
          <option value="PATERNITY">Paternity</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {leavesQuery.isLoading ? (
        <DashboardSkeleton />
      ) : leavesQuery.error ? (
        <DashboardError status={500} message={(leavesQuery.error as Error).message} />
      ) : leaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No leave requests found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {search || statusFilter || typeFilter ? 'Try adjusting your filters.' : 'Create your first leave request to get started.'}
          </p>
        </div>
      ) : (
        <LeaveTable
          leaves={leaves}
          canApprove={canApprove}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onApprove={(leave) => approveMutation.mutate(leave.id)}
          onReject={(leave) => rejectMutation.mutate(leave.id)}
          onView={setViewLeave}
          onEdit={setEditLeave}
          onDelete={setDeleteTarget}
        />
      )}

      <CreateLeaveDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditLeaveDialog
        leave={editLeave}
        open={editLeave !== null}
        onClose={() => setEditLeave(null)}
        onUpdated={invalidate}
      />

      <LeaveDetailsDialog
        leave={viewLeave}
        open={viewLeave !== null}
        onClose={() => setViewLeave(null)}
      />

      <ConfirmDeleteDialog
        entityName={deleteTarget ? `${deleteTarget.employee.firstName} ${deleteTarget.employee.lastName}'s leave request` : null}
        title="Delete Leave Request"
        description="This action cannot be undone. The leave request will be permanently removed."
        buttonLabel="Delete Request"
        successTitle="Leave request deleted"
        errorFallback="Failed to delete leave request."
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteTarget ? deleteLeave(deleteTarget.id) : Promise.resolve()}
      />
    </div>
  );
}
