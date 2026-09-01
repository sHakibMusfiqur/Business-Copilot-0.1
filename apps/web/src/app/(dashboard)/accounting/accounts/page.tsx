'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreHorizontal, BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { DataTable, type Column } from '@/components/accounting/data-table';
import { CreateAccountDialog } from '@/components/accounting/create-account-dialog';
import { EditAccountDialog } from '@/components/accounting/edit-account-dialog';
import { AccountDetailsDialog } from '@/components/accounting/account-details-dialog';
import { DeleteAccountDialog } from '@/components/accounting/delete-account-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { ACCOUNTING_ACCOUNTS_READ, ACCOUNTING_ACCOUNTS_CREATE, ACCOUNTING_ACCOUNTS_UPDATE, ACCOUNTING_ACCOUNTS_DELETE } from '@/lib/permissions';
import { getAccounts } from '@/lib/api';
import type { Account, Meta } from '@/components/accounting/accounting-types';

const typeColors: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LIABILITY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EQUITY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  REVENUE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  EXPENSE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(ACCOUNTING_ACCOUNTS_READ);
  const canUpdate = isLoaded && hasPermission(ACCOUNTING_ACCOUNTS_UPDATE);
  const canDelete = isLoaded && hasPermission(ACCOUNTING_ACCOUNTS_DELETE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [viewAccount, setViewAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);

  const query = useQuery({
    queryKey: ['accounts', { page, limit: 50, search, sortBy, sortOrder }],
    queryFn: () => getAccounts({ page, limit: 50, search: search || undefined, sortBy, sortOrder }),
    enabled: canRead,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
  }, [queryClient]);

  const handleSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) { setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortOrder('asc');
      return field;
    });
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  if (!canRead) {
    return <ForbiddenState title="Access restricted" description="You don't have permission to view accounts. Contact your organization administrator." />;
  }

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError) return <DashboardError message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;

  const data = query.data?.data ?? [];
  const meta: Meta | null = query.data?.meta ?? null;

  const columns: Column<Account>[] = [
    { key: 'code', label: 'Code', sortable: true, render: (a) => <span className="font-mono text-sm font-medium">{a.code}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (a) => <span className="text-sm">{a.name}</span> },
    {
      key: 'type', label: 'Type', sortable: true,
      render: (a) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[a.type] ?? ''}`}>
          {a.type.charAt(0) + a.type.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      key: 'parent', label: 'Parent',
      render: (a) => <span className="text-sm text-muted-foreground">{a.parent ? `${a.parent.code} - ${a.parent.name}` : '\u2014'}</span>,
    },
    {
      key: 'isActive', label: 'Active',
      render: (a) => (
        <span className={`text-xs font-medium ${a.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
          {a.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your organization's chart of accounts</p>
        </div>
        <RequirePermission permission={ACCOUNTING_ACCOUNTS_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Create Account</Button>
        </RequirePermission>
      </div>

      <DataTable
        data={data}
        meta={meta}
        columns={columns}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={query.isLoading}
        emptyIcon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
        emptyTitle="No accounts found"
        emptyDescription="No accounts match your search. Create a new account to get started."
        searchPlaceholder="Search by code or name..."
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        actions={(account) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setViewAccount(account)}>View details</DropdownMenuItem>
              {canUpdate && (
                <DropdownMenuItem onClick={() => setEditAccount(account)}>Edit account</DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={() => setDeleteAccount(account)} className="text-destructive focus:text-destructive">Delete account</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <CreateAccountDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={invalidate} />
      <EditAccountDialog account={editAccount} open={editAccount !== null} onClose={() => setEditAccount(null)} onUpdated={invalidate} />
      <AccountDetailsDialog account={viewAccount} open={viewAccount !== null} onClose={() => setViewAccount(null)} />
      <DeleteAccountDialog account={deleteAccount} open={deleteAccount !== null} onClose={() => setDeleteAccount(null)} onDeleted={invalidate} />
    </div>
  );
}
