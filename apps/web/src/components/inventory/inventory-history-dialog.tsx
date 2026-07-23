'use client';

import { useQuery } from '@tanstack/react-query';
import { X, History, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getInventoryHistory } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { InventoryProduct, InventoryTransaction } from './inventory-types';

interface InventoryHistoryDialogProps {
  product: InventoryProduct | null;
  open: boolean;
  onClose: () => void;
}

function TypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'IN':
      return (
        <Badge variant="default" className="text-xs bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 gap-1">
          <ArrowDown className="h-3 w-3" /> IN
        </Badge>
      );
    case 'OUT':
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <ArrowUp className="h-3 w-3" /> OUT
        </Badge>
      );
    case 'ADJUSTMENT':
      return (
        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
          <RefreshCw className="h-3 w-3" /> ADJ
        </Badge>
      );
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export function InventoryHistoryDialog({ product, open, onClose }: InventoryHistoryDialogProps) {
  const historyQuery = useQuery({
    queryKey: ['inventory', 'history', product?.id],
    queryFn: () => {
      if (!product) throw new Error('No product selected');
      return getInventoryHistory(product.id);
    },
    enabled: open && !!product,
  });

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Stock History</h2>
              <p className="text-sm text-muted-foreground">{product.name} ({product.sku})</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {historyQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : historyQuery.isError ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive">Failed to load history</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => historyQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : (historyQuery.data as InventoryTransaction[])?.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No transactions recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(historyQuery.data as InventoryTransaction[]).map((tx) => (
              <div
                key={tx.id}
                className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="shrink-0 pt-0.5">
                  <TypeBadge type={tx.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {tx.type === 'IN' ? `+${tx.quantity}` : tx.type === 'OUT' ? `-${tx.quantity}` : `→ ${tx.newQuantity}`}
                    </span>
                    <span className="text-muted-foreground">
                      (was {tx.previousQuantity} → {tx.newQuantity})
                    </span>
                  </div>
                  {tx.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{tx.notes}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">{tx.createdBy.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
