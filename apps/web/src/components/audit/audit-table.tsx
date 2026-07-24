'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  History,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';

import type { AuditLog, AuditMeta } from './audit-types';

interface AuditTableProps {
  logs: AuditLog[];
  meta: AuditMeta | null;
  search: string;
  actionFilter: string;
  isLoading: boolean;
  onSearchChange: (search: string) => void;
  onActionFilterChange: (action: string) => void;
  onPageChange: (page: number) => void;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN: { label: 'Login', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  LOGOUT: { label: 'Logout', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  FAILED_LOGIN: { label: 'Failed Login', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  REGISTER: { label: 'Register', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  REFRESH_TOKEN: { label: 'Refresh Token', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  FORGOT_PASSWORD: { label: 'Forgot Password', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

function getActionDisplay(action: string): { label: string; color: string } {
  return ACTION_LABELS[action] ?? { label: action, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400' };
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-36" />
        </div>
      ))}
    </div>
  );
}

export function AuditTable({
  logs,
  meta,
  search,
  actionFilter,
  isLoading,
  onSearchChange,
  onActionFilterChange,
  onPageChange,
}: AuditTableProps) {
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, onSearchChange]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {actionFilter ? actionFilter.replace(/_/g, ' ') : 'All Actions'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onActionFilterChange('')}>
              All Actions
            </DropdownMenuItem>
            {Object.entries(ACTION_LABELS).map(([key, val]) => (
              <DropdownMenuItem key={key} onClick={() => onActionFilterChange(key)}>
                {val.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            const url = `/api/audit/export${actionFilter ? `?action=${actionFilter}` : ''}`;
            window.open(url, '_blank');
          }}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No audit logs found</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const actionDisplay = getActionDisplay(log.action);
                return (
                  <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs font-medium ${actionDisplay.color}`}>
                        {actionDisplay.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={log.status === 'SUCCESS' ? 'default' : 'destructive'} className="text-xs">
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.entity && (
                        <span className="text-foreground">
                          {log.entity}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {log.user ? log.user.name || log.user.email : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                      {log.ipAddress ?? '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
              const start = Math.max(1, meta.page - 2);
              const pageNum = start + i;
              if (pageNum > meta.totalPages) return null;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === meta.page ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
