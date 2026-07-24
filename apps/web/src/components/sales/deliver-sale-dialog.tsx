'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { deliverSale } from '@/lib/api';
import type { Sale } from './sales-types';

interface DeliverSaleDialogProps {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
  onDelivered: () => void;
}

export function DeliverSaleDialog({ sale, open, onClose, onDelivered }: DeliverSaleDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');

  const deliverMutation = useMutation({
    mutationFn: () => {
      if (!sale) throw new Error('No sale selected');
      return deliverSale(sale.id, notes || undefined);
    },
    onSuccess: () => {
      toast({ title: 'Sales order delivered', description: 'Inventory has been updated.' });
      onDelivered();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to deliver sales order.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setNotes('');
    onClose();
  }

  if (!open || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Deliver Sales Order</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="rounded-full bg-blue-500/10 p-2 shrink-0">
            <Truck className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">
              Deliver {sale.orderNumber}?
            </p>
            <p className="text-sm text-muted-foreground">
              This will mark the order as delivered and decrease your inventory stock levels for all items.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Label htmlFor="deliver-notes">Delivery Notes (optional)</Label>
          <textarea
            id="deliver-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this delivery..."
            className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => deliverMutation.mutate()} disabled={deliverMutation.isPending}>
            {deliverMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Delivering...</>
            ) : 'Deliver Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
