'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal, Receipt } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { formatDate, formatCurrency } from '@/lib/utils';
import { DataTable, type Column } from '@/components/accounting/data-table';
import { ReceivableDetailsDialog } from '@/components/accounting/receivable-details-dialog';
import { getReceivables } from '@/lib/api';
import type { Receivable, Meta } from '@/components/accounting/accounting-types';

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function ReceivablesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewReceivable, setViewReceivable] = useState<Receivable | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const query = useQuery({
    queryKey: ['receivables', { page, limit: 10, search }],
    queryFn: () => getReceivables({ page, limit: 10, search: search || undefined }),
  });

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError) return <DashboardError message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;

  const data = query.data?.data ?? [];
  const meta: Meta | null = query.data?.meta ?? null;

  const columns: Column<Receivable>[] = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (r) => <span className="text-sm font-medium">{r.invoiceNumber}</span> },
    { key: 'customer', label: 'Customer', render: (r) => <span className="text-sm">{r.customer?.name ?? '\u2014'}</span> },
    { key: 'totalAmount', label: 'Total', render: (r) => <span className="text-sm font-mono">{formatCurrency(r.totalAmount)}</span> },
    { key: 'paidAmount', label: 'Paid', render: (r) => <span className="text-sm font-mono">{formatCurrency(r.paidAmount)}</span> },
    { key: 'balance', label: 'Balance', render: (r) => <span className="text-sm font-mono font-medium">{formatCurrency(r.balance)}</span> },
    { key: 'dueDate', label: 'Due Date', render: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.dueDate)}</span> },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[r.status] ?? ''}`}>
          {r.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receivables</h1>
        <p className="text-sm text-muted-foreground mt-1">Track customer invoices and outstanding payments</p>
      </div>

      <DataTable
        data={data}
        meta={meta}
        columns={columns}
        search={search}
        sortBy=""
        sortOrder="desc"
        isLoading={false}
        emptyIcon={<Receipt className="h-8 w-8 text-muted-foreground" />}
        emptyTitle="No receivables"
        emptyDescription="Receivables will appear when sales orders are delivered."
        searchPlaceholder="Search by invoice or customer..."
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={() => {}}
        actions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setViewReceivable(r)}>View details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <ReceivableDetailsDialog receivable={viewReceivable} open={viewReceivable !== null} onClose={() => setViewReceivable(null)} />
    </div>
  );
}
