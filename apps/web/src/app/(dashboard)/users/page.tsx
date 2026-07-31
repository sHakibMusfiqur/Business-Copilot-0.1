'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { UserTable } from '@/components/users/user-table';
import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { EditUserDialog } from '@/components/users/edit-user-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { StatusToggleDialog } from '@/components/ui/status-toggle-dialog';
import { deleteUser as deleteUserRequest, getUsers, updateUserStatus } from '@/lib/api';
import type { User, UsersResponse, UserMeta } from '@/components/users/user-types';

export default function UsersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [statusUser, setStatusUser] = useState<User | null>(null);

  const usersQuery = useQuery<UsersResponse>({
    queryKey: ['users', 'management', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getUsers({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['users', 'management'] });
    queryClient.invalidateQueries({ queryKey: ['users', 'org'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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

  if (usersQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (usersQuery.isError) {
    return (
      <DashboardError
        message={usersQuery.error instanceof Error ? usersQuery.error.message : undefined}
        onRetry={() => usersQuery.refetch()}
      />
    );
  }

  const usersData = usersQuery.data as UsersResponse;
  const meta: UserMeta = usersData.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts and access
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <UserTable
        users={usersData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={usersQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onEdit={setEditUser}
        onDelete={setDeleteUser}
        onToggleStatus={setStatusUser}
      />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditUserDialog
        user={editUser}
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        onUpdated={invalidate}
      />

      <ConfirmDeleteDialog
        entityName={deleteUser?.name ?? null}
        title="Delete User"
        description="This user will be deactivated and hidden from the system. Their data will not be permanently removed. This action cannot be undone."
        buttonLabel="Delete User"
        successTitle="User deleted"
        errorFallback="Failed to delete user."
        open={deleteUser !== null}
        onClose={() => setDeleteUser(null)}
        onDeleted={invalidate}
        deleteFn={() => {
          if (!deleteUser) throw new Error('No user selected');
          return deleteUserRequest(deleteUser.id);
        }}
      />

      <StatusToggleDialog
        entity={statusUser}
        entityLabel="User"
        open={statusUser !== null}
        onClose={() => setStatusUser(null)}
        onToggled={invalidate}
        updateStatus={updateUserStatus}
        activateDescription={(name) => `Activate ${name}? They will be able to log in and access the system.`}
        deactivateDescription={(name) => `Deactivate ${name}? They will not be able to log in until reactivated.`}
        errorFallback="Failed to update user status."
      />
    </div>
  );
}
