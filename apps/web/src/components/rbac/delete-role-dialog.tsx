'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Loader2, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { deleteRole } from '@/lib/api';

import type { Role } from './rbac-types';

interface DeleteRoleDialogProps {
  open: boolean;
  onClose: () => void;
  role: Role | null;
  onDeleted: () => void;
}

export function DeleteRoleDialog({ open, onClose, role, onDeleted }: DeleteRoleDialogProps) {
  const { toast } = useToast();
  const assignedUsers = role?.userCount ?? 0;
  const blocked = assignedUsers > 0;

  const deleteMutation = useMutation({
    mutationFn: () => deleteRole((role as Role).id),
    onSuccess: () => {
      toast({ title: 'Role deleted' });
      onDeleted();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not delete role',
        description: error.message ?? 'Failed to delete role.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !role) {
    return (
      <Dialog open={false} onOpenChange={() => undefined}>
        <DialogContent />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !deleteMutation.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Delete Role
          </DialogTitle>
          <DialogDescription>
            Delete <span className="font-medium text-foreground">{role.name}</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {blocked ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  This role is assigned to {assignedUsers} user{assignedUsers !== 1 ? 's' : ''}.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reassign those users to another role before deleting this role. Deleting it would remove their
                  access unexpectedly.
                </p>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={onClose}>
                  <Users className="h-3.5 w-3.5" />
                  Assign Users
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <Users className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">No users are currently assigned to this role.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deleting this role will remove its permission set. Any user who was previously assigned will lose
                  these permissions.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={blocked || deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {blocked ? 'Reassign users first' : 'Delete Role'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}