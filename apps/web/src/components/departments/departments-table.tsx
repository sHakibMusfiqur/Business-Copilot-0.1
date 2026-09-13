'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Building2,
  MoreHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Department, DepartmentListMeta } from './departments-types';

interface DepartmentTableProps {
  departments: Department[];
  meta: DepartmentListMeta | null;
  search: string;
  sortBy: string;
  sortOrder: string;
  isLoading: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  onToggleStatus?: (dept: Department) => void;
}

function SortIcon({ field, sortBy, sortOrder }: { field: string; sortBy: string; sortOrder: string }) {
  if (field !== sortBy) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
  return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-32 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

export function DepartmentTable({
  departments,
  meta,
  search,
  sortBy,
  sortOrder,
  isLoading,
  canUpdate,
  canDelete,
  onSearchChange,
  onPageChange,
  onSort,
  onEdit,
  onDelete,
  onToggleStatus,
}: DepartmentTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No departments found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {search ? 'Try adjusting your search.' : 'Create your first department to get started.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('name')}>
                        Department
                        <SortIcon field="name" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('code')}>
                        Code
                        <SortIcon field="code" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('isActive')}>
                        Status
                        <SortIcon field="isActive" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    {(canUpdate || canDelete) && (
                      <th className="w-[60px] p-4" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{dept.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{dept.code}</td>
                      <td className="px-4 py-3">
                        {dept.shared ? (
                          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                            Shared
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Organization
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {dept.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </td>
                      {(canUpdate || canDelete) && (
                        <td className="p-4">
                          {!dept.shared && (canUpdate || canDelete) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {canUpdate && (
                                  <DropdownMenuItem onClick={() => onEdit(dept)}>
                                    Edit department
                                  </DropdownMenuItem>
                                )}
                                {canUpdate && onToggleStatus && (
                                  <DropdownMenuItem onClick={() => onToggleStatus(dept)}>
                                    {dept.isActive ? 'Deactivate' : 'Activate'}
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => onDelete(dept)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      Delete department
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(1)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">{meta.page} / {meta.totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.totalPages)}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
