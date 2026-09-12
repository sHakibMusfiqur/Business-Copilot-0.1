'use client';

import { useMutation } from '@tanstack/react-query';
import { X, Loader2, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { createInvoiceFromOrder } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Sale } from '@/components/sales/sales-types';

interface CreateInvoiceFromOrderDialogProps {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateInvoiceFromOrderDialog({ sale, open, onClose, onCreated }: CreateInvoiceFromOrderDialogProps) {
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: () => {
      if (!sale) throw new Error('No sale selected');
      return createInvoiceFromOrder(sale.id);
    },
    onSuccess: () => {
      toast({ title: 'Invoice created', description: 'A new draft invoice has been created from this sales order.' });
      onCreated();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create invoice.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Invoice</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="rounded-full bg-emerald-500/10 p-2 shrink-0">
            <FileText className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">
              Create invoice from {sale.orderNumber}?
            </p>
            <p className="text-sm text-muted-foreground">
              This will create a new draft invoice with all items and totals from this delivered sales order.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{sale.customer?.name ?? '\u2014'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Order Date</span>
            <span>{formatDate(sale.orderDate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{formatCurrency(Number(sale.total))}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
            ) : 'Create Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}
