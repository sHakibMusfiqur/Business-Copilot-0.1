'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { LEAVES_READ, LEAVES_CREATE, LEAVES_UPDATE, LEAVES_DELETE, LEAVES_APPROVE, LEAVES_REJECT } from '@/lib/permissions';
import { getLeaves, deleteLeave, approveLeave, rejectLeave, cancelLeave, type Leave, type LeavesResponse } from '@/lib/api/leaves';
import { LeaveTable } from '@/components/leaves/leave-table';
import { CreateLeaveDialog } from '@/components/leaves/create-leave-dialog';
import { EditLeaveDialog } from '@/components/leaves/edit-leave-dialog';
import { LeaveDetailsDialog } from '@/components/leaves/leave-details-dialog';

export default function LeavesPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const queryClient = useQueryClient();

  const canRead = isLoaded && hasPermission(LEAVES_READ);
  const canCreate = isLoaded && hasPermission(LEAVES_CREATE);
  const canUpdate = isLoaded && hasPermission(LEAVES_UPDATE);
  const canDelete = isLoaded && hasPermission(LEAVES_DELETE);
  const canApprove = isLoaded && hasPermission(LEAVES_APPROVE);
  const canReject = isLoaded && hasPermission(LEAVES_REJECT);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [createOpen, setCreateOpen] = useState(false);
  const [editLeave, setEditLeave] = useState<Leave | null>(null);
  const [viewLeave, setViewLeave] = useState<Leave | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Leave | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Leave | null>(null);
  const [approveTarget, setApproveTarget] = useState<Leave | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Leave | null>(null);

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
  }, [statusFilter, typeFilter]);

  const leavesQuery = useQuery<LeavesResponse>({
    queryKey: ['leaves', { search, status: statusFilter, type: typeFilter, page, limit: 20, sortBy, sortOrder }],
    queryFn: ({ signal }) => getLeaves({
      search: search || undefined,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      page,
      limit: 20,
      sortBy,
      sortOrder,
    }, signal),
    enabled: canRead,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['leaves'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  }

  if (!isLoaded) return <DashboardSkeleton />;

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view leave requests. Contact your organization administrator."
      />
    );
  }

  if (leavesQuery.isError) {
    return (
      <DashboardError
        message={leavesQuery.error instanceof Error ? leavesQuery.error.message : undefined}
        onRetry={() => leavesQuery.refetch()}
      />
    );
  }

  const leaves = leavesQuery.data?.data ?? [];
  const meta = leavesQuery.data?.meta ?? null;

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

      <LeaveTable
        leaves={leaves}
        meta={meta}
        search={searchInput}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={leavesQuery.isLoading}
        canApprove={canApprove}
        canReject={canReject}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onSearchChange={setSearchInput}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
        onPageChange={setPage}
        onSort={(field) => {
          if (field === sortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortBy(field);
            setSortOrder('desc');
          }
        }}
        onApprove={setApproveTarget}
        onReject={setRejectTarget}
        onCancel={setCancelTarget}
        onView={setViewLeave}
        onEdit={setEditLeave}
        onDelete={setDeleteTarget}
      />

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

      <ConfirmDeleteDialog
        entityName={cancelTarget ? `${cancelTarget.employee.firstName} ${cancelTarget.employee.lastName}'s leave request` : null}
        title="Cancel Leave Request"
        description="This will cancel the leave request. This action cannot be undone."
        buttonLabel="Cancel Request"
        successTitle="Leave request cancelled"
        errorFallback="Failed to cancel leave request."
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => cancelTarget ? cancelLeave(cancelTarget.id) : Promise.resolve()}
        actionVerb="cancel"
        pendingLabel="Cancelling..."
      />

      <ConfirmDeleteDialog
        entityName={approveTarget ? `${approveTarget.employee.firstName} ${approveTarget.employee.lastName}'s leave request` : null}
        title="Approve Leave Request"
        description={`This will approve the ${approveTarget?.type?.toLowerCase() ?? ''} leave from ${approveTarget ? new Date(approveTarget.startDate).toLocaleDateString() : ''} to ${approveTarget ? new Date(approveTarget.endDate).toLocaleDateString() : ''}.`}
        buttonLabel="Approve"
        successTitle="Leave approved"
        errorFallback="Failed to approve leave request."
        open={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => approveTarget ? approveLeave(approveTarget.id) : Promise.resolve()}
        buttonVariant="default"
        actionVerb="approve"
        pendingLabel="Approving..."
      />

      <ConfirmDeleteDialog
        entityName={rejectTarget ? `${rejectTarget.employee.firstName} ${rejectTarget.employee.lastName}'s leave request` : null}
        title="Reject Leave Request"
        description={`This will reject the ${rejectTarget?.type?.toLowerCase() ?? ''} leave from ${rejectTarget ? new Date(rejectTarget.startDate).toLocaleDateString() : ''} to ${rejectTarget ? new Date(rejectTarget.endDate).toLocaleDateString() : ''}.`}
        buttonLabel="Reject"
        successTitle="Leave rejected"
        errorFallback="Failed to reject leave request."
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => rejectTarget ? rejectLeave(rejectTarget.id) : Promise.resolve()}
        actionVerb="reject"
        pendingLabel="Rejecting..."
      />
    </div>
  );
}
