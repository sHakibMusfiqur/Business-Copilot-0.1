'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface UseAdminListOptions<TQuery extends Record<string, unknown>> {
  queryKey: string;
  fetcher: (page: number, limit: number, filters: TQuery) => Promise<unknown>;
  limit?: number;
  defaultFilters?: TQuery;
}

/**
 * Shared pagination + filter hook for admin list pages. Debounces filter
 * changes before refetching and resets to page 1 when filters change.
 */
export function useAdminList<TItem, TQuery extends Record<string, unknown>>({
  queryKey,
  fetcher,
  limit = 20,
  defaultFilters,
}: UseAdminListOptions<TQuery>) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TQuery>((defaultFilters ?? {}) as TQuery);

  const query = useQuery({
    queryKey: [queryKey, page, limit, filters],
    queryFn: () => fetcher(page, limit, filters) as Promise<{
      data: TItem[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>,
    staleTime: 15_000,
  });

  const setFilter = <K extends keyof TQuery>(key: K, value: TQuery[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setPage(1);
  }, [filters]);

  return useMemo(
    () => ({
      page,
      setPage,
      filters,
      setFilter,
      setFilters,
      data: query.data?.data ?? [],
      meta: query.data?.meta,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    }),
    [query, page, filters],
  );
}
