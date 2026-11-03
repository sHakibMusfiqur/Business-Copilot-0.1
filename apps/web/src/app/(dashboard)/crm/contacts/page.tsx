'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ContactTable } from '@/components/crm/contact-table';
import { ContactDialog } from '@/components/crm/contact-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_READ, CRM_CREATE, CRM_UPDATE, CRM_DELETE } from '@/lib/permissions';
import { getContacts, deleteContact, getOrganizationUsers } from '@/lib/api';
import type { ContactListItem, ContactStatus, CrmListMeta } from '@/lib/api';

interface ContactListResponse {
  data: ContactListItem[];
  meta: CrmListMeta;
}

const STATUS_FILTERS: Array<{ value: '' | ContactStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function CrmContactsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(CRM_READ);
  const canUpdate = isLoaded && hasPermission(CRM_UPDATE);
  const canDelete = isLoaded && hasPermission(CRM_DELETE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'' | ContactStatus>('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editContact, setEditContact] = useState<ContactListItem | null>(null);
  const [deleteContactRow, setDeleteContactRow] = useState<ContactListItem | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: canRead,
  });

  const contactsQuery = useQuery<ContactListResponse>({
    queryKey: ['crm', 'contacts', { page, limit, search, sortBy, sortOrder, statusFilter, ownerFilter }],
    queryFn: ({ signal }) =>
      getContacts(
        {
          page,
          limit,
          search: search || undefined,
          status: statusFilter || undefined,
          ownerId: ownerFilter || undefined,
          sortBy,
          sortOrder,
        },
        signal,
      ),
    enabled: canRead,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['crm', 'contacts'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'companies'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
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
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view CRM contacts. Contact your organization administrator."
      />
    );
  }

  if (contactsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (contactsQuery.isError) {
    return (
      <DashboardError
        message={contactsQuery.error instanceof Error ? contactsQuery.error.message : undefined}
        onRetry={() => contactsQuery.refetch()}
      />
    );
  }

  const contactsData = contactsQuery.data as ContactListResponse;
  const meta: CrmListMeta = contactsData.meta;
  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            People at your accounts, with ownership and follow-up context
          </p>
        </div>
        <RequirePermission permission={CRM_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Contact
          </Button>
        </RequirePermission>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="contact-status-filter">
          Filter by status
        </label>
        <select
          id="contact-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as '' | ContactStatus);
            setPage(1);
          }}
          className="flex h-10 w-full max-w-[180px] rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="contact-owner-filter">
          Filter by owner
        </label>
        <select
          id="contact-owner-filter"
          value={ownerFilter}
          onChange={(e) => {
            setOwnerFilter(e.target.value);
            setPage(1);
          }}
          className="flex h-10 w-full max-w-[220px] rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All owners</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <ContactTable
        contacts={contactsData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={contactsQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onEdit={canUpdate ? setEditContact : undefined}
        onDelete={canDelete ? setDeleteContactRow : undefined}
      />

      <ContactDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={invalidate} />
      <ContactDialog
        open={editContact !== null}
        contact={editContact}
        onClose={() => setEditContact(null)}
        onSaved={invalidate}
      />
      <ConfirmDeleteDialog
        entityName={deleteContactRow ? `${deleteContactRow.firstName} ${deleteContactRow.lastName}` : null}
        title="Delete Contact"
        description={`This will soft-delete ${deleteContactRow ? `${deleteContactRow.firstName} ${deleteContactRow.lastName}` : ''} and detach related activities. This action cannot be undone.`}
        buttonLabel="Delete Contact"
        successTitle="Contact deleted"
        errorFallback="Failed to delete contact."
        open={deleteContactRow !== null}
        onClose={() => setDeleteContactRow(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteContact(deleteContactRow?.id ?? '')}
      />
    </div>
  );
}
