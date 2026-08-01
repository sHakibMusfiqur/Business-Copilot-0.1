'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import { getAdminAuditLogs, getAdminAuditActions } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: actions } = useQuery({
    queryKey: ['admin', 'audit', 'actions'],
    queryFn: () => getAdminAuditActions(),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', page, debouncedSearch, actionFilter],
    queryFn: () => getAdminAuditLogs(page, 20, debouncedSearch || undefined, actionFilter || undefined),
    staleTime: 10_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Platform-wide audit trail</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Actions</option>
          {actions?.map((action: string) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Timestamp</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Entity</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Organization</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && data?.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No audit logs found
                  </td>
                </tr>
              )}
              {!isLoading && data?.data?.map((log: {
                id: string;
                action: string;
                entity: string | null;
                entityId: string | null;
                status: string;
                createdAt: string;
                user: { id: string; name: string; email: string } | null;
                organization: { id: string; name: string } | null;
              }) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                      {log.action}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.entity ? `${log.entity}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.user?.name ?? 'System'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {log.organization?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.meta && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
