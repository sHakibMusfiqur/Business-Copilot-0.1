'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { CustomerTable } from '@/components/customers/customer-table';
import { CreateCustomerDialog } from '@/components/customers/create-customer-dialog';
import { EditCustomerDialog } from '@/components/customers/edit-customer-dialog';
import { DeleteCustomerDialog } from '@/components/customers/delete-customer-dialog';
import { StatusToggleDialog } from '@/components/customers/status-toggle-dialog';
import { getCustomers } from '@/lib/api';
import type { Customer, CustomersResponse, CustomerMeta } from '@/components/customers/customer-types';

export default function CustomersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [statusCustomer, setStatusCustomer] = useState<Customer | null>(null);

  const customersQuery = useQuery<CustomersResponse>({
    queryKey: ['customers', 'management', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getCustomers({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customers', 'management'] });
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

  if (customersQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (customersQuery.isError) {
    return (
      <DashboardError
        message={customersQuery.error instanceof Error ? customersQuery.error.message : undefined}
        onRetry={() => customersQuery.refetch()}
      />
    );
  }

  const customersData = customersQuery.data as CustomersResponse;
  const meta: CustomerMeta = customersData.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer accounts and information
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Customer
        </Button>
      </div>

      <CustomerTable
        customers={customersData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={customersQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onEdit={setEditCustomer}
        onDelete={setDeleteCustomer}
        onToggleStatus={setStatusCustomer}
      />

      <CreateCustomerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <EditCustomerDialog
        customer={editCustomer}
        open={editCustomer !== null}
        onClose={() => setEditCustomer(null)}
        onUpdated={invalidate}
      />

      <DeleteCustomerDialog
        customer={deleteCustomer}
        open={deleteCustomer !== null}
        onClose={() => setDeleteCustomer(null)}
        onDeleted={invalidate}
      />

      <StatusToggleDialog
        customer={statusCustomer}
        open={statusCustomer !== null}
        onClose={() => setStatusCustomer(null)}
        onToggled={invalidate}
      />
    </div>
  );
}
