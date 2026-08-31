'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { useToast } from '@/components/ui/use-toast';
import { SaleTable } from '@/components/sales/sales-table';
import { CreateSaleDialog } from '@/components/sales/create-sale-dialog';
import { EditSaleDialog } from '@/components/sales/edit-sale-dialog';
import { SaleDetailsDialog } from '@/components/sales/sale-details-dialog';
import { DeliverSaleDialog } from '@/components/sales/deliver-sale-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { deleteSale as deleteSaleRequest, getSales, confirmSale } from '@/lib/api';
import type { Sale, SaleMeta, SaleListResponse } from '@/components/sales/sales-types';

export default function SalesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [deleteSale, setDeleteSale] = useState<Sale | null>(null);
  const [deliverSale, setDeliverSale] = useState<Sale | null>(null);

  const salesQuery = useQuery<SaleListResponse>({
    queryKey: ['sales', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getSales({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmSale(id),
    onSuccess: () => {
      toast({ title: 'Sales order confirmed' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to confirm sales order.',
        variant: 'destructive',
      });
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['products', 'management'] });
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

  const handleConfirm = useCallback((sale: Sale) => {
    confirmMutation.mutate(sale.id);
  }, [confirmMutation]);

  if (salesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (salesQuery.isError) {
    return (
      <DashboardError
        message={salesQuery.error instanceof Error ? salesQuery.error.message : undefined}
        onRetry={() => salesQuery.refetch()}
      />
    );
  }

  const salesData = salesQuery.data as SaleListResponse;
  const meta: SaleMeta = salesData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sales orders and customer deliveries
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Order
        </Button>
      </div>

      <SaleTable
        sales={salesData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={salesQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onView={setViewSale}
        onEdit={setEditSale}
        onDelete={setDeleteSale}
        onConfirm={handleConfirm}
        onDeliver={setDeliverSale}
      />

      <CreateSaleDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditSaleDialog
        sale={editSale}
        open={editSale !== null}
        onClose={() => setEditSale(null)}
        onUpdated={invalidate}
      />

      <SaleDetailsDialog
        sale={viewSale}
        open={viewSale !== null}
        onClose={() => setViewSale(null)}
      />

      <ConfirmDeleteDialog
        entityName={deleteSale?.orderNumber ?? null}
        title="Delete Sales Order"
        description="Only draft orders can be deleted. This action cannot be undone."
        buttonLabel="Delete Order"
        successTitle="Sales order deleted"
        errorFallback="Failed to delete sales order."
        open={deleteSale !== null}
        onClose={() => setDeleteSale(null)}
        onDeleted={invalidate}
        deleteFn={() => {
          if (!deleteSale) throw new Error('No sale selected');
          return deleteSaleRequest(deleteSale.id);
        }}
      />

      <DeliverSaleDialog
        sale={deliverSale}
        open={deliverSale !== null}
        onClose={() => setDeliverSale(null)}
        onDelivered={invalidate}
      />
    </div>
  );
}
