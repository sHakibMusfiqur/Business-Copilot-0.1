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
  ShoppingBag,
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
import { formatDate, formatCurrency } from '@/lib/utils';

import type { Purchase, PurchaseMeta } from './purchase-types';

interface PurchaseTableProps {
  purchases: Purchase[];
  meta: PurchaseMeta | null;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onView: (purchase: Purchase) => void;
  onEdit?: (purchase: Purchase) => void;
  onDelete?: (purchase: Purchase) => void;
  onApprove?: (purchase: Purchase) => void;
  onReceive?: (purchase: Purchase) => void;
}

const statusStyle: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

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
        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No purchase orders found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        No purchase orders match your search criteria. Try adjusting your search or create a new order.
      </p>
    </div>
  );
}

export function PurchaseTable({
  purchases,
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
  onApprove,
  onReceive,
}: PurchaseTableProps) {
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
            placeholder="Search by order number or supplier..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : purchases.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('orderNumber')}>
                      <span className="inline-flex items-center">
                        Order #
                        <SortIcon field="orderNumber" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('status')}>
                      <span className="inline-flex items-center">
                        Status
                        <SortIcon field="status" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Supplier</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('total')}>
                      <span className="inline-flex items-center">
                        Total
                        <SortIcon field="total" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('orderDate')}>
                      <span className="inline-flex items-center">
                        Order Date
                        <SortIcon field="orderDate" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="w-[60px] p-4" />
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <button
                          onClick={() => onView(purchase)}
                          className="text-sm font-medium text-primary hover:underline text-left"
                        >
                          {purchase.orderNumber}
                        </button>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[purchase.status]}`}>
                          {purchase.status.charAt(0) + purchase.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {purchase.supplier?.name ?? '\u2014'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium">
                          {formatCurrency(Number(purchase.total))}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(purchase.orderDate)}
                        </span>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onView(purchase)}>
                              View details
                            </DropdownMenuItem>
                            {onEdit && (purchase.status === 'DRAFT' || purchase.status === 'PENDING') && (
                              <DropdownMenuItem onClick={() => onEdit(purchase)}>
                                Edit order
                              </DropdownMenuItem>
                            )}
                            {onApprove && purchase.status === 'PENDING' && (
                              <DropdownMenuItem onClick={() => onApprove(purchase)}>
                                Approve
                              </DropdownMenuItem>
                            )}
                            {onReceive && purchase.status === 'APPROVED' && (
                              <DropdownMenuItem onClick={() => onReceive(purchase)}>
                                Receive
                              </DropdownMenuItem>
                            )}
                            {onDelete && purchase.status === 'DRAFT' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(purchase)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Delete order
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
