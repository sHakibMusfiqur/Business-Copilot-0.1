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
  Shield,
  ShieldOff,
  Package,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';

import type { Product, ProductMeta } from './product-types';

interface ProductTableProps {
  products: Product[];
  meta: ProductMeta | null;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
}

function SortIcon({ field, sortBy, sortOrder }: { field: string; sortBy: string; sortOrder: string }) {
  if (field !== sortBy) {
    return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
  }
  return sortOrder === 'asc' ? (
    <ArrowUp className="h-3 w-3 ml-1" />
  ) : (
    <ArrowDown className="h-3 w-3 ml-1" />
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
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
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No products found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        No products match your search criteria. Try adjusting your search or create a new product.
      </p>
    </div>
  );
}

export function ProductTable({
  products,
  meta,
  search,
  sortBy,
  sortOrder,
  isLoading,
  onSearchChange,
  onPageChange,
  onSort,
  onEdit,
  onDelete,
  onToggleStatus,
}: ProductTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchInput, onSearchChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, barcode or brand..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : products.length === 0 ? (
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
                      role="button"
                      tabIndex={0}
                      aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort('name')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('name'); } }}
                    >
                      <span className="inline-flex items-center">
                        Product
                        <SortIcon field="name" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      role="button"
                      tabIndex={0}
                      aria-sort={sortBy === 'sku' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort('sku')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('sku'); } }}
                    >
                      <span className="inline-flex items-center">
                        SKU
                        <SortIcon field="sku" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Brand</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      role="button"
                      tabIndex={0}
                      aria-sort={sortBy === 'unitPrice' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort('unitPrice')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('unitPrice'); } }}
                    >
                      <span className="inline-flex items-center">
                        Price
                        <SortIcon field="unitPrice" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Stock</th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      role="button"
                      tabIndex={0}
                      aria-sort={sortBy === 'isActive' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort('isActive')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('isActive'); } }}
                    >
                      <span className="inline-flex items-center">
                        Status
                        <SortIcon field="isActive" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      role="button"
                      tabIndex={0}
                      aria-sort={sortBy === 'createdAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort('createdAt')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('createdAt'); } }}
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
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{product.name}</p>
                            {product.brand && (
                              <p className="text-xs text-muted-foreground">{product.brand}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {product.sku}
                        </code>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {product.brand ?? '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {product.category?.name ?? '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium">
                          ${Number(product.unitPrice).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm ${
                          product.minimumStock > 0 && product.currentStock <= product.minimumStock
                            ? 'text-destructive font-medium'
                            : 'text-muted-foreground'
                        }`}>
                          {product.currentStock} {product.unit}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={product.isActive ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(product.createdAt)}
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
                            <DropdownMenuItem onClick={() => onEdit(product)}>
                              Edit product
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleStatus(product)}>
                              {product.isActive ? (
                                <span className="flex items-center gap-2">
                                  <ShieldOff className="h-4 w-4" />
                                  Deactivate
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Activate
                                </span>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onDelete(product)}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete product
                            </DropdownMenuItem>
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
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={meta.page <= 1}
                  onClick={() => onPageChange(1)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={meta.page <= 1}
                  onClick={() => onPageChange(meta.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {meta.page} / {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => onPageChange(meta.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => onPageChange(meta.totalPages)}
                >
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
