'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldPlus, X, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const createRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50),
  description: z.string().max(255).optional(),
});

type CreateRoleForm = z.infer<typeof createRoleSchema>;

interface CreateRoleDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRoleDialog({ open, onClose, onCreated }: CreateRoleDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoleForm>({
    resolver: zodResolver(createRoleSchema),
  });

  async function onSubmit(data: CreateRoleForm) {
    setIsSaving(true);
    try {
      const { createRole } = await import('@/lib/api');
      await createRole(data);
      toast({ title: 'Role created', description: `Role "${data.name}" has been created.` });
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create role.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 z-50 m-auto flex max-w-md flex-col rounded-xl border bg-background shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <ShieldPlus className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Create Role</h2>
                  <p className="text-xs text-muted-foreground">Add a new role to your organization</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              <div>
                <Label htmlFor="name" className="mb-2 block text-sm font-medium">
                  Role Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Manager"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description" className="mb-2 block text-sm font-medium">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="description"
                  placeholder="e.g. Can manage team and view reports"
                  {...register('description')}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Role
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
