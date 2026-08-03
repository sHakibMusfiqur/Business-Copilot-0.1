'use client';

import { useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

import type { Role } from './rbac-types';

const duplicateRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50),
});

type DuplicateRoleForm = z.infer<typeof duplicateRoleSchema>;

interface DuplicateRoleDialogProps {
  open: boolean;
  onClose: () => void;
  role: Role;
  onDuplicated: () => void;
}

export function DuplicateRoleDialog({ open, onClose, role, onDuplicated }: DuplicateRoleDialogProps) {
  const [copyPermissions, setCopyPermissions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DuplicateRoleForm>({
    resolver: zodResolver(duplicateRoleSchema),
    values: { name: `${role.name} Copy` },
  });

  async function onSubmit(data: DuplicateRoleForm) {
    setIsSaving(true);
    try {
      const { duplicateRole } = await import('@/lib/api');
      await duplicateRole(role.id, { name: data.name, copyPermissions });
      toast({ title: 'Role duplicated', description: `Role "${data.name}" has been created.` });
      reset();
      onDuplicated();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to duplicate role.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-primary" />
            Duplicate Role
          </DialogTitle>
          <DialogDescription>
            Create a copy of <span className="font-medium text-foreground">{role.name}</span>. The copy is a
            regular role and can be edited freely.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <Label htmlFor="name" className="mb-2 block text-sm font-medium">
              Role Name
            </Label>
            <Input id="name" placeholder="e.g. Manager Copy" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Copy permissions</p>
              <p className="text-xs text-muted-foreground">Duplicate all {role.permissionCount} assigned permissions</p>
            </div>
            <Switch checked={copyPermissions} onCheckedChange={setCopyPermissions} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Duplicate Role
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
