'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  MoreHorizontal,
  Plus,
  Trash2,
  UserCog,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  activateOrganization,
  deleteAdminOrganization,
  getAdminOrganizations,
  suspendOrganization,
  type OrganizationListResponse,
} from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { AdminButton } from '@/components/admin/admin-button';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { DataTable } from '@/components/admin/data-table';
import { FilterSelect } from '@/components/admin/filter-select';
import { useAdminList } from '@/components/admin/admin-hooks';
import { PageHeader } from '@/components/admin/page-header';
import { SearchInput } from '@/components/admin/search-input';
import { StatusBadge } from '@/components/admin/status-badge';
import { toast } from '@/components/ui/use-toast';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
  { value: 'deleted', label: 'Deleted' },
];

function orgStatus(org: OrganizationListResponse): { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' } {
  if (org.deletedAt) return { label: 'Deleted', tone: 'danger' };
  if (org.archivedAt) return { label: 'Archived', tone: 'warning' };
  if (org.suspendedAt) return { label: 'Suspended', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}

export default function AdminOrganizationsPage() {
  const queryClient = useQueryClient();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'suspend' | 'activate' | 'delete'; id: string } | null>(null);

  const list = useAdminList<OrganizationListResponse, { search: string; status: string }>({
    queryKey: 'admin-orgs',
    fetcher: (page, limit, filters) =>
      getAdminOrganizations(page, limit, filters.search || undefined, filters.status || undefined),
    defaultFilters: { search: '', status: '' },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };

  const suspend = useMutation({
    mutationFn: suspendOrganization,
    onSuccess: () => { invalidate(); setConfirm(null); toast({ title: 'Organization suspended' }); },
    onError: (e: Error) => { setConfirm(null); toast({ title: e.message, variant: 'destructive' }); },
  });
  const activate = useMutation({
    mutationFn: activateOrganization,
    onSuccess: () => { invalidate(); setConfirm(null); toast({ title: 'Organization activated' }); },
    onError: (e: Error) => { setConfirm(null); toast({ title: e.message, variant: 'destructive' }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAdminOrganization(id),
    onSuccess: () => { invalidate(); setConfirm(null); toast({ title: 'Organization deleted' }); },
    onError: (e: Error) => { setConfirm(null); toast({ title: e.message, variant: 'destructive' }); },
  });

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.type === 'suspend') suspend.mutate(confirm.id);
    else if (confirm.type === 'activate') activate.mutate(confirm.id);
    else remove.mutate(confirm.id);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organizations"
        description="Manage all workspaces on the platform"
        actions={
          <Link href="/admin/organizations/create">
            <AdminButton variant="primary">
              <Plus className="h-3.5 w-3.5" /> Create Organization
            </AdminButton>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={list.filters.search}
          onChange={(v) => list.setFilter('search', v)}
          placeholder="Search name, slug, email…"
          className="w-full max-w-xs"
        />
        <FilterSelect
          value={list.filters.status}
          onChange={(v) => list.setFilter('status', v)}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          className="w-40"
        />
        <span className="ml-auto text-[12px] text-muted-foreground">
          {list.meta ? `${list.meta.total} organizations` : '…'}
        </span>
      </div>

      <DataTable
        columns={[
          {
            key: 'org',
            header: 'Organization',
            render: (org) => (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                  {org.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logo} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <Link href={`/admin/organizations/${org.id}`} className="block truncate text-[13px] font-medium text-foreground hover:underline">
                    {org.name}
                  </Link>
                  <p className="truncate text-[11px] text-muted-foreground">{org.email ?? org.slug}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'industry',
            header: 'Industry',
            render: () => <span className="text-[13px] text-muted-foreground">—</span>,
          },
          {
            key: 'owner',
            header: 'Owner',
            render: (org) => (
              <div className="min-w-0">
                <p className="truncate text-[13px]">{org.owner?.name ?? '—'}</p>
                {org.owner?.email && <p className="truncate text-[11px] text-muted-foreground">{org.owner.email}</p>}
              </div>
            ),
          },
          {
            key: 'subscription',
            header: 'Subscription',
            render: (org) => (
              <div className="min-w-0">
                <p className="truncate text-[13px]">{org.plan?.name ?? 'No plan'}</p>
                {org.subscriptionStatus && (
                  <p className="text-[11px] text-muted-foreground">{org.subscriptionStatus}</p>
                )}
              </div>
            ),
          },
          {
            key: 'employees',
            header: 'Employees',
            render: (org) => <span className="text-[13px]">{formatNumber(org.userCount)}</span>,
          },
          {
            key: 'storage',
            header: 'Storage',
            render: () => <span className="text-[13px] text-muted-foreground">—</span>,
          },
          {
            key: 'ai',
            header: 'AI Usage',
            render: () => <span className="text-[13px] text-muted-foreground">—</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (org) => <StatusBadge label={orgStatus(org).label} tone={orgStatus(org).tone} dot />,
          },
          {
            key: 'created',
            header: 'Created',
            render: (org) => <span className="whitespace-nowrap text-[13px] text-muted-foreground">{formatDate(org.createdAt)}</span>,
          },
          {
            key: 'last-active',
            header: 'Last Active',
            render: (org) => <span className="whitespace-nowrap text-[13px] text-muted-foreground">{formatDate(org.updatedAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (org) => (
              <div className="relative flex justify-end">
                <button
                  onClick={() => setMenuFor(menuFor === org.id ? null : org.id)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuFor === org.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-lg" role="menu">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        onClick={() => setMenuFor(null)}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-popover-foreground hover:bg-muted"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open Organization
                      </Link>
                      <button
                        disabled
                        title="Impersonation is not available"
                        className="flex w-full cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-[13px] text-muted-foreground/60"
                      >
                        <UserCog className="h-3.5 w-3.5" /> Impersonate Owner
                      </button>
                      <button
                        disabled
                        title="Password reset is not available"
                        className="flex w-full cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-[13px] text-muted-foreground/60"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Reset Owner Password
                      </button>
                      <div className="my-1 border-t border-border" />
                      {org.deletedAt ? null : org.archivedAt ? null : org.suspendedAt ? (
                        <button
                          onClick={() => { setMenuFor(null); setConfirm({ type: 'activate', id: org.id }); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                        </button>
                      ) : (
                        <button
                          onClick={() => { setMenuFor(null); setConfirm({ type: 'suspend', id: org.id }); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Suspend
                        </button>
                      )}
                      {!org.deletedAt && (
                        <button
                          onClick={() => { setMenuFor(null); setConfirm({ type: 'delete', id: org.id }); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ),
          },
        ]}
        data={list.data}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error instanceof Error ? list.error.message : undefined}
        onRetry={() => list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyIcon={Building2}
        emptyTitle="No organizations found"
        emptyDescription="Try adjusting your search or filters."
        rowKey={(org) => org.id}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.type === 'suspend' ? 'Suspend Organization'
          : confirm?.type === 'activate' ? 'Activate Organization'
          : 'Delete Organization'
        }
        message={
          confirm?.type === 'suspend' ? 'This will deactivate the organization and block all member access.'
          : confirm?.type === 'activate' ? 'This will reactivate the organization and restore access.'
          : 'This soft-deletes the organization. Data can be restored later.'
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete' : 'Confirm'}
        loading={suspend.isPending || activate.isPending || remove.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
