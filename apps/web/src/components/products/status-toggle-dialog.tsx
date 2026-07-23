'use client';

import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateProductStatus } from '@/lib/api';
import type { Product } from './product-types';

interface StatusToggleDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onToggled: () => void;
}

export function StatusToggleDialog({ product, open, onClose, onToggled }: StatusToggleDialogProps) {
  const { toast } = useToast();
  const newStatus = product ? !product.isActive : false;

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (!product) throw new Error('No product selected');
      return updateProductStatus(product.id, newStatus);
    },
    onSuccess: () => {
      toast({ title: newStatus ? 'Product activated' : 'Product deactivated' });
      onToggled();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update product status.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {newStatus ? 'Activate' : 'Deactivate'} Product
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {newStatus
            ? `Activate ${product.name}? It will be visible and usable across the system.`
            : `Deactivate ${product.name}? It will be hidden from most views until reactivated.`}
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
