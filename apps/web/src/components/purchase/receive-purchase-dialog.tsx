'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2, PackageCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { receivePurchase } from '@/lib/api';
import type { Purchase } from './purchase-types';

interface ReceivePurchaseDialogProps {
  purchase: Purchase | null;
  open: boolean;
  onClose: () => void;
  onReceived: () => void;
}

export function ReceivePurchaseDialog({ purchase, open, onClose, onReceived }: ReceivePurchaseDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');

  const receiveMutation = useMutation({
    mutationFn: () => {
      if (!purchase) throw new Error('No purchase selected');
      return receivePurchase(purchase.id, notes || undefined);
    },
    onSuccess: () => {
      toast({ title: 'Purchase order received', description: 'Inventory has been updated.' });
      onReceived();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to receive purchase order.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setNotes('');
    onClose();
  }

  if (!open || !purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Receive Purchase Order</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="rounded-full bg-emerald-500/10 p-2 shrink-0">
            <PackageCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">
              Receive {purchase.orderNumber}?
            </p>
            <p className="text-sm text-muted-foreground">
              This will mark the order as received and update your inventory stock levels for all items.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Label htmlFor="receive-notes">Receiving Notes (optional)</Label>
          <textarea
            id="receive-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this receipt..."
            className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending}>
            {receiveMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Receiving...</>
            ) : 'Receive Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
