'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';

import type { CompanyListItem, CrmListMeta } from '@/lib/api';

interface CompanyTableProps {
  companies: CompanyListItem[];
  meta: CrmListMeta | null;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onView: (company: CompanyListItem) => void;
  onEdit?: (company: CompanyListItem) => void;
  onDelete?: (company: CompanyListItem) => void;
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
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No companies found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        No companies match your search criteria. Try adjusting your search or create a new company.
      </p>
    </div>
  );
}

export function CompanyTable({
  companies,
  meta,
  search,
  sortBy,
  sortOrder,
  isLoading,
  onSearchChange,
  onPageChange,
  onSort,
  onView,
  onEdit,
  onDelete,
}: CompanyTableProps) {
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
            placeholder="Search by name, domain or industry..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Search companies"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : companies.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => onSort('name')}
                    >
                      <span className="inline-flex items-center">
                        Name
                        <SortIcon field="name" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => onSort('industry')}
                    >
                      <span className="inline-flex items-center">
                        Industry
                        <SortIcon field="industry" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Contact</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Owner</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Records</th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => onSort('createdAt')}
                    >
                      <span className="inline-flex items-center">
                        Created
                        <SortIcon field="createdAt" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="w-[60px] p-4" />
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <button
                          onClick={() => onView(company)}
                          className="text-sm font-medium text-primary hover:underline text-left"
                        >
                          {company.name}
                        </button>
                        {company.domain && (
                          <p className="text-xs text-muted-foreground">{company.domain}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{company.industry ?? '\u2014'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{company.email ?? company.phone ?? '\u2014'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{company.owner?.name ?? '\u2014'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {company.contactCount} contacts · {company.dealCount} deals
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{formatDate(company.createdAt)}</span>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Company actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onView(company)}>View details</DropdownMenuItem>
                            {onEdit && <DropdownMenuItem onClick={() => onEdit(company)}>Edit company</DropdownMenuItem>}
                            {onDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(company)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Delete company
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
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
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(1)} aria-label="First page">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">{meta.page} / {meta.totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.totalPages)} aria-label="Last page">
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
