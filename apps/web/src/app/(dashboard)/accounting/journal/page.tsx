'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { formatDate, formatCurrency } from '@/lib/utils';
import { DataTable, type Column } from '@/components/accounting/data-table';
import { CreateJournalDialog } from '@/components/accounting/create-journal-dialog';
import { JournalDetailsDialog } from '@/components/accounting/journal-details-dialog';
import { DeleteJournalDialog } from '@/components/accounting/delete-journal-dialog';
import { getJournalEntries, postJournalEntry } from '@/lib/api';
import type { JournalEntry, Meta } from '@/components/accounting/accounting-types';
import { useToast } from '@/components/ui/use-toast';

const statusStyle: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  POSTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export default function JournalPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<JournalEntry | null>(null);

  const query = useQuery({
    queryKey: ['journal-entries', { page, limit: 10, search, sortBy, sortOrder }],
    queryFn: () => getJournalEntries({ page, limit: 10, search: search || undefined, sortBy, sortOrder }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
  }, [queryClient]);

  const handleSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) { setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const handlePost = useCallback(async (entry: JournalEntry) => {
    try {
      await postJournalEntry(entry.id);
      toast({ title: 'Journal entry posted' });
      invalidate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post journal entry.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [toast, invalidate]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError) return <DashboardError message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;

  const data = query.data?.data ?? [];
  const meta: Meta | null = query.data?.meta ?? null;

  const columns: Column<JournalEntry>[] = [
    {
      key: 'entryNumber', label: 'Entry #', sortable: true,
      render: (e) => (
        <button onClick={() => setViewEntry(e)} className="text-sm font-medium text-primary hover:underline text-left">
          {e.entryNumber}
        </button>
      ),
    },
    { key: 'date', label: 'Date', sortable: true, render: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.date)}</span> },
    { key: 'description', label: 'Description', sortable: true, render: (e) => <span className="text-sm">{e.description}</span> },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (e) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[e.status] ?? ''}`}>
          {e.status.charAt(0) + e.status.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      key: 'totalDebit', label: 'Debit',
      render: (e) => <span className="text-sm font-mono">{formatCurrency(e.totalDebit ?? 0)}</span>,
    },
    {
      key: 'totalCredit', label: 'Credit',
      render: (e) => <span className="text-sm font-mono">{formatCurrency(e.totalCredit ?? 0)}</span>,
    },
    {
      key: 'createdBy', label: 'Created By',
      render: (e) => <span className="text-sm text-muted-foreground">{e.createdBy?.name ?? '\u2014'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal Entries</h1>
          <p className="text-sm text-muted-foreground mt-1">Double-entry bookkeeping journal</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Create Entry</Button>
      </div>

      <DataTable
        data={data}
        meta={meta}
        columns={columns}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={query.isLoading}
        emptyIcon={<FileText className="h-8 w-8 text-muted-foreground" />}
        emptyTitle="No journal entries found"
        emptyDescription="Create your first journal entry to start tracking transactions."
        searchPlaceholder="Search by entry number or description..."
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        actions={(entry) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setViewEntry(entry)}>View details</DropdownMenuItem>
              {entry.status === 'DRAFT' && (
                <>
                  <DropdownMenuItem onClick={() => handlePost(entry)}>Post entry</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleteEntry(entry)} className="text-destructive focus:text-destructive">Delete entry</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <CreateJournalDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={invalidate} />
      <JournalDetailsDialog entry={viewEntry} open={viewEntry !== null} onClose={() => setViewEntry(null)} />
      <DeleteJournalDialog entry={deleteEntry} open={deleteEntry !== null} onClose={() => setDeleteEntry(null)} onDeleted={invalidate} />
    </div>
  );
}
