'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { SupplierTable } from '@/components/suppliers/supplier-table';
import { CreateSupplierDialog } from '@/components/suppliers/create-supplier-dialog';
import { EditSupplierDialog } from '@/components/suppliers/edit-supplier-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { StatusToggleDialog } from '@/components/ui/status-toggle-dialog';
import { deleteSupplier as deleteSupplierRequest, getSuppliers, updateSupplierStatus } from '@/lib/api';
import type { Supplier, SuppliersResponse, SupplierMeta } from '@/components/suppliers/supplier-types';

export default function SuppliersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [statusSupplier, setStatusSupplier] = useState<Supplier | null>(null);

  const suppliersQuery = useQuery<SuppliersResponse>({
    queryKey: ['suppliers', 'management', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getSuppliers({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['suppliers', 'management'] });
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

  if (suppliersQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (suppliersQuery.isError) {
    return (
      <DashboardError
        message={suppliersQuery.error instanceof Error ? suppliersQuery.error.message : undefined}
        onRetry={() => suppliersQuery.refetch()}
      />
    );
  }

  const suppliersData = suppliersQuery.data as SuppliersResponse;
  const meta: SupplierMeta = suppliersData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage supplier accounts and information
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Supplier
        </Button>
      </div>

      <SupplierTable
        suppliers={suppliersData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={suppliersQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onEdit={setEditSupplier}
        onDelete={setDeleteSupplier}
        onToggleStatus={setStatusSupplier}
      />

      <CreateSupplierDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditSupplierDialog
        supplier={editSupplier}
        open={editSupplier !== null}
        onClose={() => setEditSupplier(null)}
        onUpdated={invalidate}
      />

      <ConfirmDeleteDialog
        entityName={deleteSupplier?.name ?? null}
        title="Delete Supplier"
        description="This supplier will be deactivated and hidden from the system. Their data will not be permanently removed. This action cannot be undone."
        buttonLabel="Delete Supplier"
        successTitle="Supplier deleted"
        errorFallback="Failed to delete supplier."
        open={deleteSupplier !== null}
        onClose={() => setDeleteSupplier(null)}
        onDeleted={invalidate}
        deleteFn={() => {
          if (!deleteSupplier) throw new Error('No supplier selected');
          return deleteSupplierRequest(deleteSupplier.id);
        }}
      />

      <StatusToggleDialog
        entity={statusSupplier}
        entityLabel="Supplier"
        open={statusSupplier !== null}
        onClose={() => setStatusSupplier(null)}
        onToggled={invalidate}
        updateStatus={updateSupplierStatus}
        activateDescription={(name) => `Activate ${name}? They will be visible and usable across the system.`}
        deactivateDescription={(name) => `Deactivate ${name}? They will be hidden from most views until reactivated.`}
        errorFallback="Failed to update supplier status."
      />
    </div>
  );
}
