'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2, Link2, MailPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { UserTable } from '@/components/users/user-table';
import { InviteEmployeeDialog } from '@/components/users/invite-employee-dialog';
import { EditUserDialog } from '@/components/users/edit-user-dialog';
import { EffectivePermissionsDrawer } from '@/components/rbac/effective-permissions-drawer';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { StatusToggleDialog } from '@/components/ui/status-toggle-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  deleteUser as deleteUserRequest,
  getUsers,
  updateUserStatus,
  getInvitations,
  revokeInvitation,
  resendInvitation,
} from '@/lib/api';
import type { Invitation } from '@/lib/api/invitations';
import { generateInitials } from '@/lib/utils';
import type { User, UsersResponse, UserMeta } from '@/components/users/user-types';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [statusUser, setStatusUser] = useState<User | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);

  const usersQuery = useQuery<UsersResponse>({
    queryKey: ['users', 'management', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getUsers({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const invitationsQuery = useQuery<Invitation[]>({
    queryKey: ['invitations'],
    queryFn: () => getInvitations(),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['users', 'management'] });
    queryClient.invalidateQueries({ queryKey: ['users', 'org'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['invitations'] });
  }, [queryClient]);

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      toast({ title: 'Invitation revoked', variant: 'success' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message ?? 'Failed to revoke invitation.', variant: 'destructive' });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => resendInvitation(id),
    onSuccess: (data) => {
      toast({
        title: 'Invitation resent',
        description: data.emailSent ? 'A new invitation email was sent.' : 'No SMTP configured. Use the invite link below.',
      });
      invalidate();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message ?? 'Failed to resend invitation.', variant: 'destructive' });
    },
  });

  const handleCopyLink = useCallback(async (invitationId: string) => {
    try {
      const result = await resendInvitation(invitationId);
      if (result.inviteUrl) {
        await navigator.clipboard.writeText(result.inviteUrl);
        toast({ title: 'Link copied', description: 'Invite link copied to clipboard.', variant: 'success' });
      } else {
        toast({ title: 'Link not available', description: 'The invite link is only shown when email is not configured.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not generate an invite link.', variant: 'destructive' });
    }
  }, [toast]);

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
  const pending = invitationsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite employees by email and manage access
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Invite Employee
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MailPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Pending Invitations</h2>
              <p className="text-[11px] text-muted-foreground">Employees who haven&apos;t accepted yet</p>
            </div>
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {pending.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {pending.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {generateInitials(invitation.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{invitation.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{invitation.email}</p>
                    {(invitation.department || invitation.designation) && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[invitation.department?.name, invitation.designation].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {invitation.expired ? (
                    <span className="text-xs font-medium text-destructive">Expired</span>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleCopyLink(invitation.id)}
                        disabled={resendMutation.isPending}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => resendMutation.mutate(invitation.id)}
                        disabled={resendMutation.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => revokeMutation.mutate(invitation.id)}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        onViewPermissions={setPermissionsUser}
      />

      <InviteEmployeeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onInvited={invalidate}
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

      <EffectivePermissionsDrawer
        userId={permissionsUser?.id ?? null}
        open={permissionsUser !== null}
        onClose={() => setPermissionsUser(null)}
      />
    </div>
  );
}