'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ProductTable } from '@/components/products/product-table';
import { CreateProductDialog } from '@/components/products/create-product-dialog';
import { EditProductDialog } from '@/components/products/edit-product-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { StatusToggleDialog } from '@/components/ui/status-toggle-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { usePermissions } from '@/hooks/use-permissions';
import { PRODUCTS_CREATE, PRODUCTS_UPDATE, PRODUCTS_DELETE } from '@/lib/permissions';
import { deleteProduct as deleteProductRequest, getProducts, updateProductStatus } from '@/lib/api';
import type { Product, ProductsResponse, ProductMeta } from '@/components/products/product-types';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canUpdate = isLoaded && hasPermission(PRODUCTS_UPDATE);
  const canDelete = isLoaded && hasPermission(PRODUCTS_DELETE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [statusProduct, setStatusProduct] = useState<Product | null>(null);

  const productsQuery = useQuery<ProductsResponse>({
    queryKey: ['products', 'management', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getProducts({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['products', 'management'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  const handleSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  if (productsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (productsQuery.isError) {
    return (
      <DashboardError
        message={productsQuery.error instanceof Error ? productsQuery.error.message : undefined}
        onRetry={() => productsQuery.refetch()}
      />
    );
  }

  const productsData = productsQuery.data as ProductsResponse;
  const meta: ProductMeta = productsData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage product catalog and inventory
          </p>
        </div>
        <RequirePermission permission={PRODUCTS_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Product
          </Button>
        </RequirePermission>
      </div>

      <ProductTable
        products={productsData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={productsQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onEdit={canUpdate ? setEditProduct : undefined}
        onDelete={canDelete ? setDeleteProduct : undefined}
        onToggleStatus={canUpdate ? setStatusProduct : undefined}
      />

      <CreateProductDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditProductDialog
        product={editProduct}
        open={editProduct !== null}
        onClose={() => setEditProduct(null)}
        onUpdated={invalidate}
      />

      <ConfirmDeleteDialog
        entityName={deleteProduct?.name ?? null}
        title="Delete Product"
        description="This product will be deactivated and hidden from the system. Their data will not be permanently removed. This action cannot be undone."
        buttonLabel="Delete Product"
        successTitle="Product deleted"
        errorFallback="Failed to delete product."
        open={deleteProduct !== null}
        onClose={() => setDeleteProduct(null)}
        onDeleted={invalidate}
        deleteFn={() => {
          if (!deleteProduct) throw new Error('No product selected');
          return deleteProductRequest(deleteProduct.id);
        }}
      />

      <StatusToggleDialog
        entity={statusProduct}
        entityLabel="Product"
        open={statusProduct !== null}
        onClose={() => setStatusProduct(null)}
        onToggled={invalidate}
        updateStatus={updateProductStatus}
        activateDescription={(name) => `Activate ${name}? It will be visible and usable across the system.`}
        deactivateDescription={(name) => `Deactivate ${name}? It will be hidden from most views until reactivated.`}
        errorFallback="Failed to update product status."
      />
    </div>
  );
}
