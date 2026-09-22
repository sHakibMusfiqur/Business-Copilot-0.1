'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { InvoiceTable } from '@/components/invoices/invoices-table';
import { InvoiceDetailsDialog } from '@/components/invoices/invoice-details-dialog';
import { EditInvoiceDialog } from '@/components/invoices/edit-invoice-dialog';
import { CreateInvoiceDialog } from '@/components/invoices/create-invoice-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { INVOICES_READ, INVOICES_UPDATE, INVOICES_DELETE, INVOICES_CREATE, INVOICES_APPROVE, INVOICES_REJECT } from '@/lib/permissions';
import { getInvoices, deleteInvoice, issueInvoice, cancelInvoice, emailInvoice } from '@/lib/api';
import type { Invoice, InvoiceMeta, InvoiceListResponse } from '@/components/invoices/invoices-types';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();
  const { toast } = useToast();

  const canRead = isLoaded && hasPermission(INVOICES_READ);
  const canUpdate = isLoaded && hasPermission(INVOICES_UPDATE);
  const canDelete = isLoaded && hasPermission(INVOICES_DELETE);
  const canCreate = isLoaded && hasPermission(INVOICES_CREATE);
  const canApprove = isLoaded && hasPermission(INVOICES_APPROVE);
  const canReject = isLoaded && hasPermission(INVOICES_REJECT);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  const handleIssue = useCallback(async (invoice: Invoice) => {
    try {
      await issueInvoice(invoice.id);
      toast({ title: 'Invoice issued' });
      invalidate();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to issue invoice' });
    }
  }, [toast, invalidate]);

  const handleCancel = useCallback(async (invoice: Invoice) => {
    try {
      await cancelInvoice(invoice.id);
      toast({ title: 'Invoice cancelled' });
      invalidate();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to cancel invoice' });
    }
  }, [toast, invalidate]);

  const handleEmail = useCallback(async (invoice: Invoice) => {
    try {
      await emailInvoice(invoice.id);
      toast({ title: 'Invoice emailed' });
      invalidate();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to email invoice' });
    }
  }, [toast, invalidate]);

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
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            Create Invoice
          </Button>
        )}
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
        onView={setViewInvoice}
        onEdit={canUpdate ? setEditInvoice : undefined}
        onDelete={canDelete ? setDeleteTarget : undefined}
        onIssue={canApprove ? handleIssue : undefined}
        onCancel={canReject ? handleCancel : undefined}
        onEmail={handleEmail}
      />

      <CreateInvoiceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
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

      <InvoiceDetailsDialog
        invoice={viewInvoice}
        open={viewInvoice !== null}
        onClose={() => setViewInvoice(null)}
      />

      <EditInvoiceDialog
        invoice={editInvoice}
        open={editInvoice !== null}
        onClose={() => setEditInvoice(null)}
        onUpdated={invalidate}
      />
    </div>
  );
}
