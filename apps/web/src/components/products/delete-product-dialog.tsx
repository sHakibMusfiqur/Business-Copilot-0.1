'use client';

import { useMutation } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { deleteProduct } from '@/lib/api';
import type { Product } from './product-types';

interface DeleteProductDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteProductDialog({ product, open, onClose, onDeleted }: DeleteProductDialogProps) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!product) throw new Error('No product selected');
      return deleteProduct(product.id);
    },
    onSuccess: () => {
      toast({ title: 'Product deleted' });
      onDeleted();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to delete product.',
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
          <h2 className="text-lg font-semibold">Delete Product</h2>
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
              Are you sure you want to delete {product.name}?
            </p>
            <p className="text-sm text-muted-foreground">
              This product will be deactivated and hidden from the system. Their data will not be
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
              'Delete Product'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
