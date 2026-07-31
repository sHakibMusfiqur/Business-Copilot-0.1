'use client';

import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface StatusToggleDialogProps<T extends { id: string; name: string; isActive: boolean }> {
  entity: T | null;
  entityLabel: string;
  open: boolean;
  onClose: () => void;
  onToggled: () => void;
  updateStatus: (id: string, isActive: boolean) => Promise<unknown>;
  activateDescription: (name: string) => string;
  deactivateDescription: (name: string) => string;
  errorFallback: string;
}

export function StatusToggleDialog<T extends { id: string; name: string; isActive: boolean }>({
  entity,
  entityLabel,
  open,
  onClose,
  onToggled,
  updateStatus,
  activateDescription,
  deactivateDescription,
  errorFallback,
}: StatusToggleDialogProps<T>) {
  const { toast } = useToast();
  const newStatus = entity ? !entity.isActive : false;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (!entity) throw new Error(`No ${entityLabel.toLowerCase()} selected`);
      return updateStatus(entity.id, newStatus);
    },
    onSuccess: () => {
      toast({ title: newStatus ? `${entityLabel} activated` : `${entityLabel} deactivated` });
      onToggled();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? errorFallback,
        variant: 'destructive',
      });
    },
  });

  if (!open || !entity) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${newStatus ? 'Activate' : 'Deactivate'} ${entityLabel}`}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {newStatus ? 'Activate' : 'Deactivate'} {entityLabel}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {newStatus ? activateDescription(entity.name) : deactivateDescription(entity.name)}
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
