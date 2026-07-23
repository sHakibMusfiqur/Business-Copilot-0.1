'use client';

import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateSupplierStatus } from '@/lib/api';
import type { Supplier } from './supplier-types';

interface StatusToggleDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
  onToggled: () => void;
}

export function StatusToggleDialog({ supplier, open, onClose, onToggled }: StatusToggleDialogProps) {
  const { toast } = useToast();
  const newStatus = supplier ? !supplier.isActive : false;

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (!supplier) throw new Error('No supplier selected');
      return updateSupplierStatus(supplier.id, newStatus);
    },
    onSuccess: () => {
      toast({ title: newStatus ? 'Supplier activated' : 'Supplier deactivated' });
      onToggled();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update supplier status.',
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
          <h2 className="text-lg font-semibold">
            {newStatus ? 'Activate' : 'Deactivate'} Supplier
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {newStatus
            ? `Activate ${supplier.name}? They will be visible and usable across the system.`
            : `Deactivate ${supplier.name}? They will be hidden from most views until reactivated.`}
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
