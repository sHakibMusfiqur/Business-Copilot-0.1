'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Warehouse, AlertTriangle, Package, DollarSign } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog';
import { InventoryHistoryDialog } from '@/components/inventory/inventory-history-dialog';
import { getInventory, getInventorySummary } from '@/lib/api';
import type { InventoryProduct, InventoryResponse, InventoryMeta, InventorySummary } from '@/components/inventory/inventory-types';

export default function InventoryPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [adjustProduct, setAdjustProduct] = useState<InventoryProduct | null>(null);
  const [historyProduct, setHistoryProduct] = useState<InventoryProduct | null>(null);

  const inventoryQuery = useQuery<InventoryResponse>({
    queryKey: ['inventory', 'management', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getInventory({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const summaryQuery = useQuery<InventorySummary>({
    queryKey: ['inventory', 'summary'],
    queryFn: () => getInventorySummary(),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory', 'management'] });
    queryClient.invalidateQueries({ queryKey: ['inventory', 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['products', 'management'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  const handleSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  if (inventoryQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (inventoryQuery.isError) {
    return (
      <DashboardError
        message={inventoryQuery.error instanceof Error ? inventoryQuery.error.message : undefined}
        onRetry={() => inventoryQuery.refetch()}
      />
    );
  }

  const inventoryData = inventoryQuery.data as InventoryResponse;
  const meta: InventoryMeta = inventoryData.meta;
  const summary: InventorySummary | undefined = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage stock levels and inventory movements
          </p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Products</p>
                <p className="text-lg font-semibold">{summary.totalProducts}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Warehouse className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Units</p>
                <p className="text-lg font-semibold">{summary.totalStockUnits}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inventory Value</p>
                <p className="text-lg font-semibold">${summary.inventoryValue.toFixed(2)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${summary.lowStockCount + summary.outOfStockCount > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-primary/10'}`}>
                <AlertTriangle className={`h-4 w-4 ${summary.lowStockCount + summary.outOfStockCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-primary'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low / Out</p>
                <p className="text-lg font-semibold">{summary.lowStockCount + summary.outOfStockCount}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <InventoryTable
        products={inventoryData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={inventoryQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onAdjust={setAdjustProduct}
        onHistory={setHistoryProduct}
      />

      <StockAdjustmentDialog
        product={adjustProduct}
        open={adjustProduct !== null}
        onClose={() => setAdjustProduct(null)}
        onAdjusted={invalidate}
      />

      <InventoryHistoryDialog
        product={historyProduct}
        open={historyProduct !== null}
        onClose={() => setHistoryProduct(null)}
      />
    </div>
  );
}
