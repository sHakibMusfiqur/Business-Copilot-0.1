'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';

import { getAdminAuditActions, getAdminAuditLogs } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { DataTable } from '@/components/admin/data-table';
import { FilterSelect } from '@/components/admin/filter-select';
import { useAdminList } from '@/components/admin/admin-hooks';
import { PageHeader } from '@/components/admin/page-header';
import { SearchInput } from '@/components/admin/search-input';
import { StatusBadge } from '@/components/admin/status-badge';

interface AuditRow {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  organization: { id: string; name: string } | null;
}

export default function AdminAuditPage() {
  const actions = useQuery({
    queryKey: ['admin', 'audit', 'actions'],
    queryFn: () => getAdminAuditActions(),
    staleTime: 60_000,
  });

  const list = useAdminList<AuditRow, { search: string; action: string }>({
    queryKey: 'admin-audit',
    fetcher: (page, limit, filters) =>
      getAdminAuditLogs(page, limit, filters.search || undefined, filters.action || undefined),
    defaultFilters: { search: '', action: '' },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Logs" description="Platform-wide audit trail" />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search by action, entity…" className="w-full max-w-xs" />
        <FilterSelect
          value={list.filters.action}
          onChange={(v) => list.setFilter('action', v)}
          options={(actions.data ?? []).map((a: string) => ({ value: a, label: a }))}
          placeholder="All actions"
          className="w-64"
        />
        <span className="ml-auto text-[12px] text-muted-foreground">
          {list.meta ? `${list.meta.total} events` : '…'}
        </span>
      </div>

      <DataTable
        columns={[
          {
            key: 'timestamp',
            header: 'Timestamp',
            render: (log) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{formatDateTime(log.createdAt)}</span>,
          },
          {
            key: 'action',
            header: 'Action',
            render: (log) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{log.action}</code>,
          },
          {
            key: 'entity',
            header: 'Entity',
            render: (log) => (
              <span className="text-[13px] text-foreground">
                {log.entity ? `${log.entity}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}` : '—'}
              </span>
            ),
          },
          {
            key: 'user',
            header: 'User',
            render: (log) => (
              <span className="text-[13px] text-foreground">{log.user?.name ?? 'System'}</span>
            ),
          },
          {
            key: 'org',
            header: 'Organization',
            render: (log) => <span className="text-[13px] text-muted-foreground">{log.organization?.name ?? '—'}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (log) => <StatusBadge label={log.status} tone={log.status === 'SUCCESS' ? 'success' : 'danger'} dot />,
          },
        ]}
        data={list.data}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error instanceof Error ? list.error.message : undefined}
        onRetry={() => list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyIcon={ScrollText}
        emptyTitle="No audit events found"
        emptyDescription="Try adjusting your search or filters."
        rowKey={(log) => log.id}
      />
    </div>
  );
}
