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
  FileText,
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

import type { Invoice, InvoiceMeta, InvoiceStatus, PaymentStatus } from './invoices-types';

interface InvoiceTableProps {
  invoices: Invoice[];
  meta: InvoiceMeta | null;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onView?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
}

const statusStyle: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const paymentStatusStyle: Record<PaymentStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  REFUNDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
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
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        No invoices match your search criteria. Try adjusting your search or create an invoice from a delivered sales order.
      </p>
    </div>
  );
}

export function InvoiceTable({
  invoices,
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
}: InvoiceTableProps) {
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
            placeholder="Search by invoice number or customer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : invoices.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('invoiceNumber')}>
                      <span className="inline-flex items-center">
                        Invoice #
                        <SortIcon field="invoiceNumber" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Sales Order</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('issueDate')}>
                      <span className="inline-flex items-center">
                        Issue Date
                        <SortIcon field="issueDate" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Due Date</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('total')}>
                      <span className="inline-flex items-center justify-end">
                        Total
                        <SortIcon field="total" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Paid</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Balance</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Payment</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('status')}>
                      <span className="inline-flex items-center">
                        Status
                        <SortIcon field="status" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="w-[60px] p-4" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        {onView ? (
                          <button
                            onClick={() => onView(invoice)}
                            className="text-sm font-medium text-primary hover:underline text-left"
                          >
                            {invoice.invoiceNumber}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-left">
                            {invoice.invoiceNumber}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {invoice.customer?.name ?? '\u2014'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {invoice.salesOrder?.orderNumber ?? '\u2014'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(invoice.issueDate)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {invoice.dueDate ? formatDate(invoice.dueDate) : '\u2014'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-medium">
                          {formatCurrency(Number(invoice.total))}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(Number(invoice.paidAmount))}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-medium">
                          {formatCurrency(Number(invoice.balance))}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentStatusStyle[invoice.paymentStatus]}`}>
                          {invoice.paymentStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[invoice.status]}`}>
                          {invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}
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
                            {onView && (
                              <DropdownMenuItem onClick={() => onView(invoice)}>
                                View details
                              </DropdownMenuItem>
                            )}
                            {onEdit && invoice.status === 'DRAFT' && (
                              <DropdownMenuItem onClick={() => onEdit(invoice)}>
                                Edit invoice
                              </DropdownMenuItem>
                            )}
                            {onDelete && invoice.status === 'DRAFT' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(invoice)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Delete invoice
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
