'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { LEAVES_READ, LEAVES_CREATE, LEAVES_UPDATE, LEAVES_DELETE, LEAVES_APPROVE, LEAVES_REJECT } from '@/lib/permissions';
import { getLeaves, deleteLeave, approveLeave, rejectLeave, cancelLeave, type Leave, type LeavesResponse } from '@/lib/api/leaves';
import { useToast } from '@/components/ui/use-toast';
import { LeaveTable } from '@/components/leaves/leave-table';
import { CreateLeaveDialog } from '@/components/leaves/create-leave-dialog';
import { EditLeaveDialog } from '@/components/leaves/edit-leave-dialog';
import { LeaveDetailsDialog } from '@/components/leaves/leave-details-dialog';

export default function LeavesPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        onApprove={(leave) => approveMutation.mutate(leave.id)}
        onReject={(leave) => rejectMutation.mutate(leave.id)}
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
      />
    </div>
  );
}
