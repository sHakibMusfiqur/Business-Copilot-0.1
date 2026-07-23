'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { updateUser, getRoles } from '@/lib/api';
import type { Role } from '@/components/rbac/rbac-types';
import type { User } from './user-types';

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditUserDialog({ user, open, onClose, onUpdated }: EditUserDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: getRoles,
    enabled: open,
  });

  useEffect(() => {
    if (user) {
      setName(user.name);
      setSelectedRoleIds(user.roleAssignments.map((ra) => ra.role.id));
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('No user selected');
      return updateUser(user.id, { name, roleIds: selectedRoleIds });
    },
    onSuccess: () => {
      toast({ title: 'User updated' });
      onUpdated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update user.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setName('');
    setSelectedRoleIds([]);
    setErrors({});
    onClose();
  }

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  }

  function handleSubmit() {
    const result = updateUserSchema.safeParse({ name });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    updateMutation.mutate();
  }

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Edit User</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>

          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label>Assign Roles</Label>
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
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading roles...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
