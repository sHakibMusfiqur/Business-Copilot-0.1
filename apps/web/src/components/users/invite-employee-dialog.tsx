'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  createInvitation,
  getDepartments,
  getOrganizationUsers,
  getRoles,
  getRolePermissions,
} from '@/lib/api';
import type { Role, OrganizationUser } from '@/components/rbac/rbac-types';

const inviteSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

interface InviteEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export function InviteEmployeeDialog({ open, onClose, onInvited }: InviteEmployeeDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [managerId, setManagerId] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => getRoles(),
    enabled: open,
  });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => getDepartments(),
    enabled: open,
  });
  const managersQuery = useQuery<OrganizationUser[]>({
    queryKey: ['users', 'assignable'],
    queryFn: () => getOrganizationUsers(),
    enabled: open,
  });

  const permissionsQuery = useQuery({
    queryKey: ['role-permissions', selectedRoleIds],
    queryFn: async () => {
      const results = await Promise.all(selectedRoleIds.map((roleId) => getRolePermissions(roleId)));
      return results.flat();
    },
    enabled: open && selectedRoleIds.length > 0,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      createInvitation({
        name,
        email,
        departmentId: departmentId || undefined,
        designation: designation.trim() || undefined,
        managerId: managerId || undefined,
        roleIds: selectedRoleIds,
      }),
    onSuccess: (data) => {
      toast({
        title: 'Invitation created',
        description: data.message,
        variant: 'success',
      });
      if (!data.emailSent && data.inviteUrl) {
        setCreatedInviteUrl(data.inviteUrl);
        return;
      }
      onInvited();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create invitation.',
        variant: 'destructive',
      });
    },
  });

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const permission of permissionsQuery.data ?? []) {
      const moduleName = permission.module || 'Other';
      if (!map.has(moduleName)) map.set(moduleName, new Set());
      map.get(moduleName)?.add(permission.label ?? permission.name);
    }
    return Array.from(map.entries()).map(([moduleName, labels]) => ({
      module: moduleName,
      labels: Array.from(labels).sort(),
    }));
  }, [permissionsQuery.data]);

  function handleClose() {
    setName('');
    setEmail('');
    setDepartmentId('');
    setDesignation('');
    setManagerId('');
    setSelectedRoleIds([]);
    setErrors({});
    setCreatedInviteUrl(null);
    onClose();
  }

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  }

  function handleSubmit() {
    const result = inviteSchema.safeParse({ name, email });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    inviteMutation.mutate();
  }

  async function copyInviteLink() {
    if (!createdInviteUrl) return;
    try {
      await navigator.clipboard.writeText(createdInviteUrl);
      toast({ title: 'Link copied', description: 'Invite link copied to clipboard.', variant: 'success' });
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  }

  const rolesSelected = selectedRoleIds.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-6">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold">Invite Employee</h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {createdInviteUrl ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-8 text-center">
              <ShieldCheck className="h-8 w-8 text-amber-500" />
              <p className="text-sm font-medium text-foreground">
                Invitation created but no SMTP is configured.
              </p>
              <p className="text-xs text-muted-foreground">
                Share the invite link manually to onboard this employee.
              </p>
              <div className="w-full">
                <Input value={createdInviteUrl} readOnly className="text-xs" />
              </div>
              <div className="flex gap-3">
                <Button type="button" onClick={copyInviteLink}>Copy link</Button>
                <Button type="button" variant="outline" onClick={() => { onInvited(); handleClose(); }}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Full name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className={errors.name ? 'border-destructive mt-1' : 'mt-1'}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="email">Work email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className={errors.email ? 'border-destructive mt-1' : 'mt-1'}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">No department</option>
                  {departmentsQuery.data?.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Staff Accountant"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="manager">Manager</Label>
                <select
                  id="manager"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">No manager</option>
                  {managersQuery.data?.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Assign roles</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {rolesQuery.data?.map((role) => (
                  <Badge
                    key={role.id}
                    variant={selectedRoleIds.includes(role.id) ? 'default' : 'outline'}
                    className="cursor-pointer transition-all hover:opacity-80"
                    onClick={() => toggleRole(role.id)}
                  >
                    {role.name}
                  </Badge>
                ))}
                {rolesQuery.isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading roles...
                  </div>
                )}
                {rolesQuery.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No roles available</p>
                )}
              </div>
            </div>

            {rolesSelected && (
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Permissions granted by selected roles
                </div>
                {permissionsQuery.isLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading permissions...
                  </div>
                ) : groupedPermissions.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No permissions assigned to the selected roles.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {groupedPermissions.map((group) => (
                      <div key={group.module}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.module}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {group.labels.map((label) => (
                            <span key={label} className="rounded-md bg-background px-2 py-0.5 text-[11px] text-foreground ring-1 ring-border">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 text-xs text-muted-foreground">
              When you save, {email ? <span className="font-medium text-foreground">{email}</span> : 'the employee'} will receive a branded invitation email with a secure link to set their password and join.
            </div>
          </div>
        )}

        {!createdInviteUrl && (
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={inviteMutation.isPending || inviteMutation.isSuccess}>
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}