'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { adjustStock } from '@/lib/api';
import type { InventoryProduct } from './inventory-types';

const stockSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
});

interface StockAdjustmentDialogProps {
  product: InventoryProduct | null;
  open: boolean;
  onClose: () => void;
  onAdjusted: () => void;
}

export function StockAdjustmentDialog({ product, open, onClose, onAdjusted }: StockAdjustmentDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const adjustMutation = useMutation({
    mutationFn: () => {
      if (!product) throw new Error('No product selected');
      return adjustStock({
        productId: product.id,
        type,
        quantity: Number(quantity),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Stock adjusted successfully' });
      onAdjusted();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to adjust stock.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setType('IN');
    setQuantity('');
    setNotes('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const result = stockSchema.safeParse({ type, quantity: quantity ? Number(quantity) : 0 });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    adjustMutation.mutate();
  }

  if (!open || !product) return null;

  const canOut = product.currentStock > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Adjust Stock</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <p className="text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">SKU: {product.sku} | Current Stock: {product.currentStock}</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="type">Transaction Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="IN">IN — Add Stock</option>
              <option value="OUT" disabled={!canOut}>OUT — Remove Stock</option>
              <option value="ADJUSTMENT">ADJUSTMENT — Set Stock</option>
            </select>
          </div>

          <div>
            <Label htmlFor="quantity">
              {type === 'ADJUSTMENT' ? 'New Stock Level' : 'Quantity'}
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === 'ADJUSTMENT' ? 'New total stock' : 'Quantity'}
              className={errors.quantity ? 'border-destructive' : ''}
            />
            {errors.quantity && <p className="text-xs text-destructive mt-1">{errors.quantity}</p>}
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={adjustMutation.isPending}>
            {adjustMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adjusting...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
