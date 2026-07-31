'use client';

import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface ConfirmDeleteDialogProps {
  entityName: string | null;
  title: string;
  description: string;
  buttonLabel: string;
  successTitle: string;
  errorFallback: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  deleteFn: () => Promise<unknown>;
}

export function ConfirmDeleteDialog({
  entityName,
  title,
  description,
  buttonLabel,
  successTitle,
  errorFallback,
  open,
  onClose,
  onDeleted,
  deleteFn,
}: ConfirmDeleteDialogProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      toast({ title: successTitle });
      onDeleted();
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

  if (!open || !entityName) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="rounded-full bg-destructive/10 p-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">
              Are you sure you want to delete {entityName}?
            </p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              buttonLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
