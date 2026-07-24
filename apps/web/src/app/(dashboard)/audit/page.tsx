'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';

import { getAuditLogs } from '@/lib/api';
import { AuditTable } from '@/components/audit/audit-table';
import type { AuditListResponse } from '@/components/audit/audit-types';

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy] = useState('createdAt');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 20;

  const { data, isLoading } = useQuery<AuditListResponse>({
    queryKey: ['audit', { page, limit, search, action: actionFilter, sortBy, sortOrder }],
    queryFn: () =>
      getAuditLogs({
        page,
        limit,
        search: search || undefined,
        action: actionFilter || undefined,
        sortBy,
        sortOrder,
      }),
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleActionFilter = useCallback((action: string) => {
    setActionFilter(action);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <History className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Track all important actions across the platform
          </p>
        </div>
      </div>

      <AuditTable
        logs={data?.data ?? []}
        meta={data?.meta ?? null}
        search={search}
        actionFilter={actionFilter}
        isLoading={isLoading}
        onSearchChange={handleSearch}
        onActionFilterChange={handleActionFilter}
        onPageChange={setPage}
      />
    </div>
  );
}
