'use client';

import { useMemo, useState } from 'react';
import { CopyCheck, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

import type { Role } from './rbac-types';

interface ClonePermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  targetRole: Role;
  roles: Role[];
  onCloned: () => void;
}

export function ClonePermissionsDialog({ open, onClose, targetRole, roles, onCloned }: ClonePermissionsDialogProps) {
  const [sourceRoleId, setSourceRoleId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const sourceRoles = useMemo(() => roles.filter((role) => role.id !== targetRole.id), [roles, targetRole.id]);

  const selectedSource = sourceRoles.find((role) => role.id === sourceRoleId);

  async function onSubmit() {
    if (!sourceRoleId) {
      toast({ title: 'Select a source role', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { clonePermissions } = await import('@/lib/api');
      await clonePermissions(targetRole.id, sourceRoleId);
      toast({
        title: 'Permissions copied',
        description: `Permissions copied from "${selectedSource?.name ?? ''}" to "${targetRole.name}".`,
      });
      setSourceRoleId('');
      onCloned();
      onClose();
    } catch (error) {
      toast({
        title: 'Could not copy permissions',
        description: error instanceof Error ? error.message : 'Failed to copy permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyCheck className="h-4 w-4 text-primary" />
            Clone Permissions
          </DialogTitle>
          <DialogDescription>
            Replace all permissions on <span className="font-medium text-foreground">{targetRole.name}</span>{' '}
            with the permissions from another role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label htmlFor="source-role" className="mb-2 block text-sm font-medium">
              Copy permissions from
            </Label>
            <select
              id="source-role"
              value={sourceRoleId}
              onChange={(e) => setSourceRoleId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="" disabled>
                Select a source role
              </option>
              {sourceRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.permissionCount} permissions)
                </option>
              ))}
            </select>
          </div>

          {selectedSource && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{selectedSource.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedSource.permissionCount} permissions will replace the current set on {targetRole.name}.
              </p>
            </div>
          )}

          {sourceRoles.length === 0 && (
            <p className="text-sm text-muted-foreground">No other roles available to copy from.</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={isSaving || !sourceRoleId}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Clone Permissions
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
