'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { usePermissions } from '@/hooks/use-permissions';
import { PURCHASE_CREATE, PURCHASE_UPDATE, PURCHASE_DELETE, PURCHASE_APPROVE, PURCHASE_RECEIVE } from '@/lib/permissions';
import { deletePurchase as deletePurchaseRequest, getPurchases, approvePurchase } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useMutation } from '@tanstack/react-query';
import type { Purchase, PurchaseMeta, PurchaseListResponse } from '@/components/purchase/purchase-types';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isLoaded } = usePermissions();

  const canUpdate = isLoaded && hasPermission(PURCHASE_UPDATE);
  const canDelete = isLoaded && hasPermission(PURCHASE_DELETE);
  const canApprove = isLoaded && hasPermission(PURCHASE_APPROVE);
  const canReceive = isLoaded && hasPermission(PURCHASE_RECEIVE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [deletePurchase, setDeletePurchase] = useState<Purchase | null>(null);
  const [receivePurchase, setReceivePurchase] = useState<Purchase | null>(null);

  const purchasesQuery = useQuery<PurchaseListResponse>({
    queryKey: ['purchases', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getPurchases({ page, limit, search: search || undefined, sortBy, sortOrder }),
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
        isLoading={purchasesQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onView={setViewPurchase}
        onEdit={canUpdate ? setEditPurchase : undefined}
        onDelete={canDelete ? setDeletePurchase : undefined}
        onApprove={canApprove ? handleApprove : undefined}
        onReceive={canReceive ? setReceivePurchase : undefined}
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
