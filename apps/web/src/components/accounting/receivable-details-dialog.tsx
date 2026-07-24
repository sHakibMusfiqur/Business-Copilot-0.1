'use client';

import { X } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Receivable } from './accounting-types';

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

interface ReceivableDetailsDialogProps {
  receivable: Receivable | null;
  open: boolean;
  onClose: () => void;
}

export function ReceivableDetailsDialog({ receivable, open, onClose }: ReceivableDetailsDialogProps) {
  if (!open || !receivable) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Receivable Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><p className="text-xs text-muted-foreground mb-1">Invoice</p><p className="text-sm font-medium">{receivable.invoiceNumber}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Status</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[receivable.status] ?? ''}`}>
              {receivable.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          </div>
          <div><p className="text-xs text-muted-foreground mb-1">Customer</p><p className="text-sm">{receivable.customer?.name ?? '\u2014'}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Due Date</p><p className="text-sm">{formatDate(receivable.dueDate)}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Total Amount</p><p className="text-sm font-mono">{formatCurrency(receivable.totalAmount)}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Paid Amount</p><p className="text-sm font-mono">{formatCurrency(receivable.paidAmount)}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Outstanding</p><p className="text-sm font-mono font-medium">{formatCurrency(receivable.balance)}</p></div>
          {receivable.notes && <div className="col-span-2"><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-sm">{receivable.notes}</p></div>}
        </div>
      </div>
    </div>
  );
}
