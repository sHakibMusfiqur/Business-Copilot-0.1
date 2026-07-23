'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { AssignUserRolesModal } from '@/components/rbac/assign-user-roles-modal';
import { CreateRoleDialog } from '@/components/rbac/create-role-dialog';
import { PermissionAssignmentDialog } from '@/components/rbac/permission-assignment-dialog';
import { RoleDetailsDrawer } from '@/components/rbac/role-details-drawer';
import { RoleList } from '@/components/rbac/role-list';
import type { Role, RoleDetails, OrganizationUser, GroupedPermissions } from '@/components/rbac/rbac-types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  getRoles,
  getRoleById,
  getPermissionsGrouped,
  assignPermissions,
  getOrganizationUsers,
  assignUserRoles,
  deleteRole as apiDeleteRole,
} from '@/lib/api';

export default function RolesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedRole, setSelectedRole] = useState<RoleDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  const permissionsGroupedQuery = useQuery<GroupedPermissions>({
    queryKey: ['permissions', 'grouped'],
    queryFn: getPermissionsGrouped,
  });

  const usersQuery = useQuery<OrganizationUser[]>({
    queryKey: ['users', 'org'],
    queryFn: getOrganizationUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => apiDeleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({ title: 'Role deleted' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete role.', variant: 'destructive' });
    },
  });

  const assignPermsMutation = useMutation({
    mutationFn: ({ roleId, permissionNames }: { roleId: string; permissionNames: string[] }) =>
      assignPermissions(roleId, permissionNames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      if (selectedRole) {
        queryClient.invalidateQueries({ queryKey: ['roles', selectedRole.id] });
      }
    },
  });

  const assignUserRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      assignUserRoles(userId, roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'org'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const openRoleDrawer = useCallback(async (role: Role) => {
    try {
      const details = await getRoleById(role.id);
      setSelectedRole(details);
      setDrawerOpen(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to load role details.', variant: 'destructive' });
    }
  }, [toast]);

  const openPermissionDialog = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => setPermDialogOpen(true), 150);
  }, []);

  const openAssignModal = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => setAssignModalOpen(true), 150);
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage roles and control access to features
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      <RoleList
        roles={rolesQuery.data ?? []}
        onSelect={openRoleDrawer}
        onDelete={(role) => deleteMutation.mutate(role.id)}
      />

      <RoleDetailsDrawer
        role={selectedRole}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEditPermissions={openPermissionDialog}
        onAssignUsers={openAssignModal}
      />

      {selectedRole && (
        <PermissionAssignmentDialog
          open={permDialogOpen}
          onClose={() => setPermDialogOpen(false)}
          roleId={selectedRole.id}
          roleName={selectedRole.name}
          initialPermissions={selectedRole.permissions.map((p) => p.name)}
          groupedPermissions={permissionsGroupedQuery.data ?? null}
          isLoadingPermissions={permissionsGroupedQuery.isLoading}
          onSave={async (permissionNames) => {
            await assignPermsMutation.mutateAsync({ roleId: selectedRole.id, permissionNames });
          }}
        />
      )}

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

      <CreateRoleDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['roles'] })}
      />
    </div>
  );
}
