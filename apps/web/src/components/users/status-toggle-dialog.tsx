'use client';

import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateUserStatus } from '@/lib/api';
import type { User } from './user-types';

interface StatusToggleDialogProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onToggled: () => void;
}

export function StatusToggleDialog({ user, open, onClose, onToggled }: StatusToggleDialogProps) {
  const { toast } = useToast();
  const newStatus = user ? !user.isActive : false;

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('No user selected');
      return updateUserStatus(user.id, newStatus);
    },
    onSuccess: () => {
      toast({ title: newStatus ? 'User activated' : 'User deactivated' });
      onToggled();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update user status.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {newStatus ? 'Activate' : 'Deactivate'} User
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {newStatus
            ? `Activate ${user.name}? They will be able to log in and access the system.`
            : `Deactivate ${user.name}? They will not be able to log in until reactivated.`}
        </p>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={newStatus ? 'default' : 'destructive'}
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              newStatus ? 'Activate' : 'Deactivate'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
