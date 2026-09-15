'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { CreateInvoiceFromOrderDialog } from '@/components/invoices/create-invoice-from-order-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { SALES_READ, SALES_CREATE, SALES_UPDATE, SALES_DELETE, SALES_APPROVE, SALES_DELIVER, INVOICES_CREATE } from '@/lib/permissions';
import { deleteSale as deleteSaleRequest, getSales, confirmSale, getCustomers, cancelSale } from '@/lib/api';
import type { Sale, SaleMeta, SaleListResponse } from '@/components/sales/sales-types';

export default function SalesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(SALES_READ);
  const canUpdate = isLoaded && hasPermission(SALES_UPDATE);
  const canDelete = isLoaded && hasPermission(SALES_DELETE);
  const canApprove = isLoaded && hasPermission(SALES_APPROVE);
  const canDeliver = isLoaded && hasPermission(SALES_DELIVER);
  const canCreateInvoice = isLoaded && hasPermission(INVOICES_CREATE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [deleteSale, setDeleteSale] = useState<Sale | null>(null);
  const [deliverSale, setDeliverSale] = useState<Sale | null>(null);
  const [createInvoiceTarget, setCreateInvoiceTarget] = useState<Sale | null>(null);
  const [cancelSaleTarget, setCancelSaleTarget] = useState<Sale | null>(null);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, customerFilter, dateFrom, dateTo]);

  const customersQuery = useQuery({
    queryKey: ['customers', 'filter'],
    queryFn: ({ signal }) => getCustomers({ limit: 200, isActive: true }, signal),
    staleTime: 5 * 60 * 1000,
  });

  const salesQuery = useQuery<SaleListResponse>({
    queryKey: ['sales', { page, limit, search, sortBy, sortOrder, status: statusFilter, customerId: customerFilter, dateFrom, dateTo }],
    queryFn: () => getSales({
      page,
      limit,
      search: search || undefined,
      sortBy,
      sortOrder,
      status: statusFilter || undefined,
      customerId: customerFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    enabled: canRead,
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

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSale(id),
    onSuccess: () => {
      toast({ title: 'Sales order cancelled' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to cancel sales order.',
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

  const handleCancel = useCallback((sale: Sale) => {
    cancelMutation.mutate(sale.id);
  }, [cancelMutation]);

  if (!canRead) {
    return <ForbiddenState title="Access restricted" description="You don't have permission to view sales. Contact your organization administrator." />;
  }

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
        <RequirePermission permission={SALES_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Order
          </Button>
        </RequirePermission>
      </div>

      <SaleTable
        sales={salesData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        statusFilter={statusFilter}
        customerFilter={customerFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        customers={customersQuery.data?.data ?? []}
        isLoading={salesQuery.isLoading}
        onSearchChange={handleSearch}
        onStatusChange={setStatusFilter}
        onCustomerChange={setCustomerFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onPageChange={setPage}
        onSort={handleSort}
        onView={setViewSale}
        onEdit={canUpdate ? setEditSale : undefined}
        onDelete={canDelete ? setDeleteSale : undefined}
        onConfirm={canApprove ? handleConfirm : undefined}
        onDeliver={canDeliver ? setDeliverSale : undefined}
        onCancel={canUpdate ? setCancelSaleTarget : undefined}
        onCreateInvoice={canCreateInvoice ? setCreateInvoiceTarget : undefined}
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

      <ConfirmDeleteDialog
        entityName={cancelSaleTarget?.orderNumber ?? null}
        title="Cancel Sales Order"
        description="This will cancel the sales order. This action cannot be undone."
        buttonLabel="Cancel Order"
        successTitle="Sales order cancelled"
        errorFallback="Failed to cancel sales order."
        open={cancelSaleTarget !== null}
        onClose={() => setCancelSaleTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => {
          if (!cancelSaleTarget) throw new Error('No sale selected');
          return cancelSale(cancelSaleTarget.id);
        }}
        actionVerb="cancel"
        pendingLabel="Cancelling..."
      />

      <DeliverSaleDialog
        sale={deliverSale}
        open={deliverSale !== null}
        onClose={() => setDeliverSale(null)}
        onDelivered={invalidate}
      />

      <CreateInvoiceFromOrderDialog
        sale={createInvoiceTarget}
        open={createInvoiceTarget !== null}
        onClose={() => setCreateInvoiceTarget(null)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          invalidate();
        }}
      />
    </div>
  );
}
