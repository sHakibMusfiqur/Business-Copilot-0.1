'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Trash2,
  Loader2,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import {
  getAdminOrganizations,
  suspendOrganization,
  activateOrganization,
  deleteAdminOrganization,
} from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { OrganizationListResponse } from '@/lib/api';

function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminOrganizationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionOrg, setActionOrg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'suspend' | 'activate' | 'delete'; id: string } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'organizations', page, debouncedSearch, statusFilter],
    queryFn: () => getAdminOrganizations(page, 20, debouncedSearch || undefined, statusFilter || undefined),
    staleTime: 15_000,
  });

  const suspendMutation = useMutation({
    mutationFn: suspendOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      setActionOrg(null);
      setConfirmAction(null);
    },
    onError: () => setConfirmAction(null),
  });

  const activateMutation = useMutation({
    mutationFn: activateOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      setActionOrg(null);
      setConfirmAction(null);
    },
    onError: () => setConfirmAction(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      setActionOrg(null);
      setConfirmAction(null);
    },
    onError: () => setConfirmAction(null),
  });

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmAction?.type === 'suspend'}
        title="Suspend Organization"
        message="This will deactivate the organization and prevent all users from accessing it. Are you sure?"
        loading={suspendMutation.isPending}
        onConfirm={() => confirmAction && suspendMutation.mutate(confirmAction.id)}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction?.type === 'activate'}
        title="Activate Organization"
        message="This will reactivate the organization and restore access for all users. Are you sure?"
        loading={activateMutation.isPending}
        onConfirm={() => confirmAction && activateMutation.mutate(confirmAction.id)}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction?.type === 'delete'}
        title="Delete Organization"
        message="This will soft-delete the organization. Data can be restored later. Are you sure?"
        loading={deleteMutation.isPending}
        onConfirm={() => confirmAction && deleteMutation.mutate(confirmAction.id)}
        onCancel={() => setConfirmAction(null)}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage all organizations on the platform</p>
        </div>
        <Link
          href="/admin/organizations/create"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Organization
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Search organizations"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">
                    Organization <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Owner</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Users</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && data?.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No organizations found
                  </td>
                </tr>
              )}
              {!isLoading && data?.data?.map((org: OrganizationListResponse) => (
                <tr key={org.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.email ?? org.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{org.owner?.name ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">{org.owner?.email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{org.plan?.name ?? 'No Plan'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {org.deletedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <XCircle className="h-3 w-3" />
                        Deleted
                      </span>
                    ) : org.archivedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Archived
                      </span>
                    ) : org.suspendedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        <XCircle className="h-3 w-3" />
                        Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{org.userCount}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(org.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setActionOrg(actionOrg === org.id ? null : org.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                        aria-label={`Actions for ${org.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {actionOrg === org.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActionOrg(null)} />
                          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-popover p-1 shadow-lg" role="menu">
                            <button
                              onClick={() => { setActionOrg(null); }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-accent"
                              role="menuitem"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Details
                            </button>
                            {org.deletedAt ? null : org.archivedAt ? null : org.suspendedAt ? (
                              <button
                                onClick={() => setConfirmAction({ type: 'activate', id: org.id })}
                                disabled={activateMutation.isPending}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-500/10"
                                role="menuitem"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Activate
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmAction({ type: 'suspend', id: org.id })}
                                disabled={suspendMutation.isPending}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-amber-600 hover:bg-amber-500/10"
                                role="menuitem"
                              >
                                <XCircle className="h-4 w-4" />
                                Suspend
                              </button>
                            )}
                            {!org.deletedAt && (
                              <button
                                onClick={() => setConfirmAction({ type: 'delete', id: org.id })}
                                disabled={deleteMutation.isPending}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                                role="menuitem"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.meta && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                aria-label="Previous page"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
