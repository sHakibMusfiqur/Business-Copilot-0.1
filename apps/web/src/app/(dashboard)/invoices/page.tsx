'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { InvoiceTable } from '@/components/invoices/invoices-table';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { INVOICES_READ, INVOICES_DELETE } from '@/lib/permissions';
import { getInvoices, deleteInvoice } from '@/lib/api';
import type { Invoice, InvoiceMeta, InvoiceListResponse } from '@/components/invoices/invoices-types';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(INVOICES_READ);
  const canDelete = isLoaded && hasPermission(INVOICES_DELETE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const invoicesQuery = useQuery<InvoiceListResponse>({
    queryKey: ['invoices', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getInvoices({ page, limit, search: search || undefined, sortBy, sortOrder }),
    enabled: canRead,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
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

  if (!canRead) {
    return <ForbiddenState title="Access restricted" description="You don't have permission to view invoices. Contact your organization administrator." />;
  }

  if (invoicesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (invoicesQuery.isError) {
    return (
      <DashboardError
        message={invoicesQuery.error instanceof Error ? invoicesQuery.error.message : undefined}
        onRetry={() => invoicesQuery.refetch()}
      />
    );
  }

  const invoicesData = invoicesQuery.data as InvoiceListResponse;
  const meta: InvoiceMeta = invoicesData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage invoices and payment tracking
          </p>
        </div>
      </div>

      <InvoiceTable
        invoices={invoicesData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={invoicesQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onDelete={canDelete ? setDeleteTarget : undefined}
      />

      <ConfirmDeleteDialog
        entityName={deleteTarget?.invoiceNumber ?? null}
        title="Delete Invoice"
        description="Only draft invoices can be deleted. This action cannot be undone."
        buttonLabel="Delete Invoice"
        successTitle="Invoice deleted"
        errorFallback="Failed to delete invoice."
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => {
          if (!deleteTarget) throw new Error('No invoice selected');
          return deleteInvoice(deleteTarget.id);
        }}
      />
    </div>
  );
}
