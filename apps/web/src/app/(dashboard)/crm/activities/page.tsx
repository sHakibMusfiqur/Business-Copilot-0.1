'use client';

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ActivityTable } from '@/components/crm/activity-table';
import { ActivityDialog } from '@/components/crm/activity-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_READ, CRM_CREATE, CRM_UPDATE, CRM_DELETE } from '@/lib/permissions';
import { getActivities, toggleActivity, deleteActivity, getOrganizationUsers } from '@/lib/api';
import type { CrmActivity, CrmListMeta, ActivityListParams } from '@/lib/api';

interface ActivityListResponse {
  data: CrmActivity[];
  meta: CrmListMeta;
}

type ViewKey = 'upcoming' | 'overdue' | 'completed' | 'all';

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE'] as const;

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export default function CrmActivitiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(CRM_READ);
  const canUpdate = isLoaded && hasPermission(CRM_UPDATE);
  const canDelete = isLoaded && hasPermission(CRM_DELETE);

  const [view, setView] = useState<ViewKey>('upcoming');
  const [typeFilter, setTypeFilter] = useState<'' | (typeof ACTIVITY_TYPES)[number]>('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [editActivity, setEditActivity] = useState<CrmActivity | null>(null);
  const [deleteActivityRow, setDeleteActivityRow] = useState<CrmActivity | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: canRead,
  });

  const listParams: ActivityListParams = useMemo(() => {
    const base: ActivityListParams = {
      page,
      limit,
      search: search || undefined,
      type: typeFilter || undefined,
      assignedToId: assigneeFilter || undefined,
    };
    if (view === 'upcoming') {
      return { ...base, completed: false, from: todayIsoDate(), sortBy: 'dueDate', sortOrder: 'asc' };
    }
    if (view === 'overdue') {
      return { ...base, overdue: true, sortBy: 'dueDate', sortOrder: 'asc' };
    }
    if (view === 'completed') {
      return { ...base, completed: true, sortBy: 'dueDate', sortOrder: 'desc' };
    }
    return { ...base, sortBy: 'createdAt', sortOrder: 'desc' };
  }, [view, typeFilter, assigneeFilter, search, page]);

  const activitiesQuery = useQuery<ActivityListResponse>({
    queryKey: ['crm', 'activities', view, { page, typeFilter, assigneeFilter, search }],
    queryFn: ({ signal }) => getActivities(listParams, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['crm', 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  const setPending = useCallback((id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleActivity(id),
    onMutate: (id) => setPending(id, true),
    onSuccess: (_data, id) => {
      setPending(id, false);
      invalidate();
    },
    onError: (error: Error, id) => {
      setPending(id, false);
      invalidate();
      toast({
        title: 'Update failed',
        description: error.message ?? 'The activity could not be updated.',
        variant: 'destructive',
      });
    },
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const changeView = useCallback((next: ViewKey) => {
    setView(next);
    setPage(1);
  }, []);

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view CRM activities. Contact your organization administrator."
      />
    );
  }

  if (activitiesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (activitiesQuery.isError) {
    return (
      <DashboardError
        message={activitiesQuery.error instanceof Error ? activitiesQuery.error.message : undefined}
        onRetry={() => activitiesQuery.refetch()}
      />
    );
  }

  const activitiesData = activitiesQuery.data as ActivityListResponse;
  const meta: CrmListMeta = activitiesData.meta;
  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Calls, emails, meetings and tasks across your CRM records
          </p>
        </div>
        <RequirePermission permission={CRM_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Activity
          </Button>
        </RequirePermission>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Activity views" className="flex rounded-lg border p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => changeView(v.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === v.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="activity-type-filter">
          Filter by type
        </label>
        <select
          id="activity-type-filter"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as '' | (typeof ACTIVITY_TYPES)[number]);
            setPage(1);
          }}
          className="flex h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All types</option>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="activity-assignee-filter">
          Filter by assignee
        </label>
        <select
          id="activity-assignee-filter"
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setPage(1);
          }}
          className="flex h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <ActivityTable
        activities={activitiesData.data}
        meta={meta}
        search={search}
        isLoading={activitiesQuery.isLoading}
        pendingIds={pendingIds}
        canToggle={canUpdate}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onToggle={(activity) => toggleMutation.mutate(activity.id)}
        onEdit={canUpdate ? setEditActivity : undefined}
        onDelete={canDelete ? setDeleteActivityRow : undefined}
      />

      <ActivityDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={invalidate}
      />
      <ActivityDialog
        open={editActivity !== null}
        activity={editActivity}
        onClose={() => setEditActivity(null)}
        onSaved={invalidate}
      />
      <ConfirmDeleteDialog
        entityName={deleteActivityRow?.title ?? null}
        title="Delete Activity"
        description={`This will delete the activity "${deleteActivityRow?.title ?? ''}". This action cannot be undone.`}
        buttonLabel="Delete Activity"
        successTitle="Activity deleted"
        errorFallback="Failed to delete activity."
        open={deleteActivityRow !== null}
        onClose={() => setDeleteActivityRow(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteActivity(deleteActivityRow?.id ?? '')}
      />
    </div>
  );
}
