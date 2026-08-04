'use client';

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';

import { getAdminOrganizations, getAdminUsers } from '@/lib/api';
import { cn, formatDate, generateInitials } from '@/lib/utils';
import { DataTable } from '@/components/admin/data-table';
import { FilterSelect } from '@/components/admin/filter-select';
import { useAdminList } from '@/components/admin/admin-hooks';
import { PageHeader } from '@/components/admin/page-header';
import { SearchInput } from '@/components/admin/search-input';
import { StatusBadge } from '@/components/admin/status-badge';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  avatar: string | null;
  organization: { id: string; name: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_OPTIONS = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER'].map((r) => ({
  value: r,
  label: r.replace('_', ' '),
}));

export default function AdminUsersPage() {
  const orgs = useQuery({
    queryKey: ['admin', 'organizations', 'all'],
    queryFn: () => getAdminOrganizations(1, 100),
    staleTime: 60_000,
  });

  const list = useAdminList<AdminUser, { search: string; organizationId: string; role: string }>({
    queryKey: 'admin-users',
    fetcher: (page, limit, filters) =>
      getAdminUsers(page, limit, filters.search || undefined, filters.organizationId || undefined, filters.role || undefined),
    defaultFilters: { search: '', organizationId: '', role: '' },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Users" description="Every account across all organizations" />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search name or email…" className="w-full max-w-xs" />
        <FilterSelect
          value={list.filters.organizationId}
          onChange={(v) => list.setFilter('organizationId', v)}
          options={((orgs.data?.data ?? []) as { id: string; name: string }[]).map((o) => ({ value: o.id, label: o.name }))}
          placeholder="All organizations"
          className="w-48"
        />
        <FilterSelect
          value={list.filters.role}
          onChange={(v) => list.setFilter('role', v)}
          options={ROLE_OPTIONS}
          placeholder="All roles"
          className="w-40"
        />
        <span className="ml-auto text-[12px] text-muted-foreground">
          {list.meta ? `${list.meta.total} users` : '…'}
        </span>
      </div>

      <DataTable
        columns={[
          {
            key: 'user',
            header: 'User',
            render: (u) => (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {u.name ? generateInitials(u.name) : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{u.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'role',
            header: 'Role',
            render: (u) => (
              <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', 'bg-muted text-muted-foreground')}>
                {u.role}
              </span>
            ),
          },
          {
            key: 'org',
            header: 'Organization',
            render: (u) => <span className="text-[13px] text-foreground">{u.organization?.name ?? '—'}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (u) => <StatusBadge label={u.isActive ? 'Active' : 'Blocked'} tone={u.isActive ? 'success' : 'danger'} dot />,
          },
          {
            key: 'last-login',
            header: 'Last Login',
            render: (u) => <span className="whitespace-nowrap text-[13px] text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</span>,
          },
          {
            key: 'created',
            header: 'Created',
            render: (u) => <span className="whitespace-nowrap text-[13px] text-muted-foreground">{formatDate(u.createdAt)}</span>,
          },
        ]}
        data={list.data}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error instanceof Error ? list.error.message : undefined}
        onRetry={() => list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyIcon={Users}
        emptyTitle="No users found"
        emptyDescription="Try adjusting your search or filters."
        rowKey={(u) => u.id}
      />
    </div>
  );
}
