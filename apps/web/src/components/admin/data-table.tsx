'use client';

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ErrorState, LoadingState } from './states';
import { Pagination } from './pagination';
import type { AdminListMeta, TableColumn } from './types';

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  meta?: AdminListMeta;
  onPageChange?: (page: number) => void;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  rowKey: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  meta,
  onPageChange,
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = 'No records found',
  emptyDescription,
  className,
  rowKey,
}: DataTableProps<T>) {
  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <LoadingState rows={5} />
                </td>
              </tr>
            )}
            {!isLoading && isError && (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <ErrorState message={errorMessage} onRetry={onRetry} />
                </td>
              </tr>
            )}
            {!isLoading && !isError && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                      <EmptyIcon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                    {emptyDescription && (
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{emptyDescription}</p>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && !isError && data.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-muted/40">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-2.5 align-middle text-[13px]', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && onPageChange && (
        <Pagination meta={meta} onPageChange={onPageChange} />
      )}
    </div>
  );
}
