'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { PAYMENTS_READ, PAYMENTS_CREATE } from '@/lib/permissions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { DataTable, type Column } from '@/components/accounting/data-table';
import { CreatePaymentDialog } from '@/components/accounting/create-payment-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { getPayments } from '@/lib/api';
import type { Payment, Meta } from '@/components/accounting/accounting-types';

const noopSearch = () => {};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();
  const canRead = isLoaded && hasPermission(PAYMENTS_READ);

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ['payments', { page, limit: 10 }],
    queryFn: () => getPayments({ page, limit: 10 }),
    enabled: canRead,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
  }

  if (!canRead) {
    return <ForbiddenState title="Access restricted" description="You don't have permission to view payments. Contact your organization administrator." />;
  }

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError) return <DashboardError message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;

  const data = query.data?.data ?? [];
  const meta: Meta | null = query.data?.meta ?? null;

  const columns: Column<Payment>[] = [
    {
      key: 'type', label: 'Type',
      render: (p) => (
        <span className={`text-xs font-medium ${p.type === 'CUSTOMER_PAYMENT' ? 'text-emerald-600' : 'text-blue-600'}`}>
          {p.type === 'CUSTOMER_PAYMENT' ? 'Customer Payment' : 'Supplier Payment'}
        </span>
      ),
    },
    {
      key: 'party', label: 'Party',
      render: (p) => <span className="text-sm">{p.customer?.name ?? p.supplier?.name ?? '\u2014'}</span>,
    },
    { key: 'amount', label: 'Amount', render: (p) => <span className="text-sm font-mono font-medium">{formatCurrency(p.amount)}</span> },
    { key: 'paymentDate', label: 'Date', render: (p) => <span className="text-sm text-muted-foreground">{formatDate(p.paymentDate)}</span> },
    { key: 'reference', label: 'Reference', render: (p) => <span className="text-sm text-muted-foreground">{p.reference ?? '\u2014'}</span> },
    {
      key: 'createdBy', label: 'Created By',
      render: (p) => <span className="text-sm text-muted-foreground">{p.createdBy?.name ?? '\u2014'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Record and view customer and supplier payments</p>
        </div>
        <RequirePermission permission={PAYMENTS_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Record Payment</Button>
        </RequirePermission>
      </div>

      <DataTable
        data={data}
        meta={meta}
        columns={columns}
        search=""
        sortBy=""
        sortOrder="desc"
        isLoading={false}
        emptyIcon={<DollarSign className="h-8 w-8 text-muted-foreground" />}
        emptyTitle="No payments"
        emptyDescription="No payments recorded yet."
        searchPlaceholder="Search payments..."
        onSearchChange={noopSearch}
        onPageChange={setPage}
        onSort={() => {}}
      />

      <CreatePaymentDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={invalidate} />
    </div>
  );
}
