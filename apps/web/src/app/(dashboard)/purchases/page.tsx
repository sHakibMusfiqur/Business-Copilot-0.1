'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { PurchaseTable } from '@/components/purchase/purchase-table';
import { CreatePurchaseDialog } from '@/components/purchase/create-purchase-dialog';
import { EditPurchaseDialog } from '@/components/purchase/edit-purchase-dialog';
import { PurchaseDetailsDialog } from '@/components/purchase/purchase-details-dialog';
import { ReceivePurchaseDialog } from '@/components/purchase/receive-purchase-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { PURCHASE_READ, PURCHASE_CREATE, PURCHASE_UPDATE, PURCHASE_DELETE, PURCHASE_APPROVE, PURCHASE_RECEIVE } from '@/lib/permissions';
import { deletePurchase as deletePurchaseRequest, getPurchases, approvePurchase, submitPurchase, cancelPurchase, getSuppliers } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Purchase, PurchaseMeta, PurchaseListResponse } from '@/components/purchase/purchase-types';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(PURCHASE_READ);
  const canUpdate = isLoaded && hasPermission(PURCHASE_UPDATE);
  const canDelete = isLoaded && hasPermission(PURCHASE_DELETE);
  const canApprove = isLoaded && hasPermission(PURCHASE_APPROVE);
  const canReceive = isLoaded && hasPermission(PURCHASE_RECEIVE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [deletePurchase, setDeletePurchase] = useState<Purchase | null>(null);
  const [receivePurchase, setReceivePurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, supplierFilter, dateFrom, dateTo]);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'filter'],
    queryFn: ({ signal }) => getSuppliers({ limit: 200, isActive: true }, signal),
    staleTime: 5 * 60 * 1000,
  });

  const purchasesQuery = useQuery<PurchaseListResponse>({
    queryKey: ['purchases', { page, limit, search, sortBy, sortOrder, status: statusFilter, supplierId: supplierFilter, dateFrom, dateTo }],
    queryFn: () => getPurchases({
      page,
      limit,
      search: search || undefined,
      sortBy,
      sortOrder,
      status: statusFilter || undefined,
      supplierId: supplierFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    enabled: canRead,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvePurchase(id),
    onSuccess: () => {
      toast({ title: 'Purchase order approved' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to approve purchase order.',
        variant: 'destructive',
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitPurchase(id),
    onSuccess: () => {
      toast({ title: 'Purchase order submitted' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to submit purchase order.',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPurchase(id),
    onSuccess: () => {
      toast({ title: 'Purchase order cancelled' });
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to cancel purchase order.',
        variant: 'destructive',
      });
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
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

  const handleApprove = useCallback((purchase: Purchase) => {
    approveMutation.mutate(purchase.id);
  }, [approveMutation]);

  const handleSubmit = useCallback((purchase: Purchase) => {
    submitMutation.mutate(purchase.id);
  }, [submitMutation]);

  const handleCancel = useCallback((purchase: Purchase) => {
    cancelMutation.mutate(purchase.id);
  }, [cancelMutation]);

  if (!canRead) {
    return <ForbiddenState title="Access restricted" description="You don't have permission to view purchases. Contact your organization administrator." />;
  }

  if (purchasesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (purchasesQuery.isError) {
    return (
      <DashboardError
        message={purchasesQuery.error instanceof Error ? purchasesQuery.error.message : undefined}
        onRetry={() => purchasesQuery.refetch()}
      />
    );
  }

  const purchasesData = purchasesQuery.data as PurchaseListResponse;
  const meta: PurchaseMeta = purchasesData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage purchase orders and supplier deliveries
          </p>
        </div>
        <RequirePermission permission={PURCHASE_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Order
          </Button>
        </RequirePermission>
      </div>

      <PurchaseTable
        purchases={purchasesData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        statusFilter={statusFilter}
        supplierFilter={supplierFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        suppliers={suppliersQuery.data?.data ?? []}
        isLoading={purchasesQuery.isLoading}
        onSearchChange={handleSearch}
        onStatusChange={setStatusFilter}
        onSupplierChange={setSupplierFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onPageChange={setPage}
        onSort={handleSort}
        onView={setViewPurchase}
        onEdit={canUpdate ? setEditPurchase : undefined}
        onDelete={canDelete ? setDeletePurchase : undefined}
        onApprove={canApprove ? handleApprove : undefined}
        onSubmit={canUpdate ? handleSubmit : undefined}
        onReceive={canReceive ? setReceivePurchase : undefined}
        onCancel={canUpdate ? handleCancel : undefined}
      />

      <CreatePurchaseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditPurchaseDialog
        purchase={editPurchase}
        open={editPurchase !== null}
        onClose={() => setEditPurchase(null)}
        onUpdated={invalidate}
      />

      <PurchaseDetailsDialog
        purchase={viewPurchase}
        open={viewPurchase !== null}
        onClose={() => setViewPurchase(null)}
      />

      <ConfirmDeleteDialog
        entityName={deletePurchase?.orderNumber ?? null}
        title="Delete Purchase Order"
        description="Only draft orders can be deleted. This action cannot be undone."
        buttonLabel="Delete Order"
        successTitle="Purchase order deleted"
        errorFallback="Failed to delete purchase order."
        open={deletePurchase !== null}
        onClose={() => setDeletePurchase(null)}
        onDeleted={invalidate}
        deleteFn={() => {
          if (!deletePurchase) throw new Error('No purchase selected');
          return deletePurchaseRequest(deletePurchase.id);
        }}
      />

      <ReceivePurchaseDialog
        purchase={receivePurchase}
        open={receivePurchase !== null}
        onClose={() => setReceivePurchase(null)}
        onReceived={invalidate}
      />
    </div>
  );
}
