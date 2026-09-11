'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { AssignUserRolesModal } from '@/components/rbac/assign-user-roles-modal';
import { ClonePermissionsDialog } from '@/components/rbac/clone-permissions-dialog';
import { DeleteRoleDialog } from '@/components/rbac/delete-role-dialog';
import { DuplicateRoleDialog } from '@/components/rbac/duplicate-role-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { RoleFormModal } from '@/components/rbac/role-form-modal';
import { RoleTable } from '@/components/rbac/role-table';
import type { Role, GroupedPermissions } from '@/components/rbac/rbac-types';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import {
  getRoles,
  getPermissionsGrouped,
  getOrganizationUsers,
  assignUserRoles,
} from '@/lib/api';

export default function RolesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, permissions, isLoaded } = usePermissions();
  const canManageRoles = isLoaded ? hasPermission('organization.manage') : true;

  const [editRole, setEditRole] = useState<{
    id: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    permissions: Array<{ name: string }>;
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<Role | null>(null);
  const [cloneTarget, setCloneTarget] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => getRoles(),
  });

  const permissionsGroupedQuery = useQuery<GroupedPermissions>({
    queryKey: ['permissions', 'grouped'],
    queryFn: () => getPermissionsGrouped(),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'org'],
    queryFn: () => getOrganizationUsers(),
  });

  const assignUserRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      assignUserRoles(userId, roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'org'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'effective-permissions'] });
    },
  });

  const openCreateModal = useCallback(() => {
    setEditRole(null);
    setFormOpen(true);
  }, []);

  const openEditModal = useCallback((role: Role) => {
    setEditRole({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: (role.permissions ?? []).map((name) => ({ name })),
    });
    setFormOpen(true);
  }, []);

  if (isLoaded && !hasPermission('organization.manage')) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="Only organization owners can manage roles and permissions. Contact your organization owner to request access."
      />
    );
  }

  if (rolesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (rolesQuery.isError) {
    return (
      <DashboardError
        message={rolesQuery.error instanceof Error ? rolesQuery.error.message : undefined}
        onRetry={() => rolesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manage Role</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dashboard &gt; Role
          </p>
        </div>
        <RequirePermission permission="organization.manage">
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        </RequirePermission>
      </div>

      {/* Role table */}
      <RoleTable
        roles={rolesQuery.data ?? []}
        onEdit={canManageRoles ? openEditModal : undefined}
        onDelete={canManageRoles ? (role) => setDeleteTarget(role) : undefined}
        onDuplicate={canManageRoles ? (role) => setDuplicateTarget(role) : undefined}
        onClonePermissions={canManageRoles ? (role) => setCloneTarget(role) : undefined}
      />

      {/* Create / Edit Role Modal */}
      <RoleFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditRole(null);
        }}
        role={editRole}
        groupedPermissions={permissionsGroupedQuery.data ?? null}
        actorPermissions={permissions}
        isLoadingPermissions={permissionsGroupedQuery.isLoading}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['roles'] })}
      />

      {/* Assign User Roles Modal */}
      <AssignUserRolesModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        users={usersQuery.data ?? []}
        roles={rolesQuery.data ?? []}
        isLoadingUsers={usersQuery.isLoading}
        onAssign={async (userId, roleIds) => {
          await assignUserRolesMutation.mutateAsync({ userId, roleIds });
        }}
      />

      {/* Duplicate Role Dialog */}
      {duplicateTarget && (
        <DuplicateRoleDialog
          open={!!duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
          role={duplicateTarget}
          onDuplicated={() => queryClient.invalidateQueries({ queryKey: ['roles'] })}
        />
      )}

      {/* Clone Permissions Dialog */}
      {cloneTarget && (
        <ClonePermissionsDialog
          open={!!cloneTarget}
          onClose={() => setCloneTarget(null)}
          targetRole={cloneTarget}
          roles={rolesQuery.data ?? []}
          onCloned={() => queryClient.invalidateQueries({ queryKey: ['roles'] })}
        />
      )}

      {/* Delete Role Dialog */}
      <DeleteRoleDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        role={deleteTarget}
        onDeleted={() => {
          setEditRole(null);
          queryClient.invalidateQueries({ queryKey: ['roles'] });
        }}
      />
    </div>
  );
}
