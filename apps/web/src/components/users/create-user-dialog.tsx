'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { createUser, getRoles } from '@/lib/api';
import type { Role } from '@/components/rbac/rbac-types';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateUserDialog({ open, onClose, onCreated }: CreateUserDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => getRoles(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => createUser({ name, email, roleIds: selectedRoleIds }),
    onSuccess: (data) => {
      toast({
        title: 'User created',
        description: `Temporary password: ${data.temporaryPassword}`,
      });
      onCreated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create user.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setName('');
    setEmail('');
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
    const result = createUserSchema.safeParse({ name, email });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    createMutation.mutate();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create User</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
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
              {rolesQuery.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No roles available</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create User'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
