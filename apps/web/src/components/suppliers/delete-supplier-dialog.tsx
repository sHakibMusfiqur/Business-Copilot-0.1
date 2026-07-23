'use client';

import { useMutation } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { deleteSupplier } from '@/lib/api';
import type { Supplier } from './supplier-types';

interface DeleteSupplierDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteSupplierDialog({ supplier, open, onClose, onDeleted }: DeleteSupplierDialogProps) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!supplier) throw new Error('No supplier selected');
      return deleteSupplier(supplier.id);
    },
    onSuccess: () => {
      toast({ title: 'Supplier deleted' });
      onDeleted();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to delete supplier.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Delete Supplier</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="rounded-full bg-destructive/10 p-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">
              Are you sure you want to delete {supplier.name}?
            </p>
            <p className="text-sm text-muted-foreground">
              This supplier will be deactivated and hidden from the system. Their data will not be
              permanently removed. This action cannot be undone.
            </p>
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
              'Delete Supplier'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
