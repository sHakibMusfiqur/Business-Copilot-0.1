'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { LeadTable } from '@/components/crm/lead-table';
import { CreateLeadDialog } from '@/components/crm/create-lead-dialog';
import { EditLeadDialog } from '@/components/crm/edit-lead-dialog';
import { LeadDetailsDialog } from '@/components/crm/lead-details-dialog';
import { DeleteLeadDialog } from '@/components/crm/delete-lead-dialog';
import { ChangeStatusDialog } from '@/components/crm/change-status-dialog';
import { AssignUserDialog } from '@/components/crm/assign-user-dialog';
import { CreateActivityDialog } from '@/components/crm/create-activity-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_CREATE, CRM_UPDATE, CRM_DELETE } from '@/lib/permissions';
import { getLeads } from '@/lib/api';
import type { LeadListItem, LeadListResponse, Meta } from '@/components/crm/crm-types';

export default function CrmLeadsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canCreate = isLoaded && hasPermission(CRM_CREATE);
  const canUpdate = isLoaded && hasPermission(CRM_UPDATE);
  const canDelete = isLoaded && hasPermission(CRM_DELETE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadListItem | null>(null);
  const [viewLead, setViewLead] = useState<LeadListItem | null>(null);
  const [deleteLead, setDeleteLead] = useState<LeadListItem | null>(null);
  const [statusLead, setStatusLead] = useState<LeadListItem | null>(null);
  const [assignLead, setAssignLead] = useState<LeadListItem | null>(null);
  const [activityLead, setActivityLead] = useState<LeadListItem | null>(null);

  const leadsQuery = useQuery<LeadListResponse>({
    queryKey: ['crm', 'leads', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => getLeads({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'summary'] });
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

  if (leadsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (leadsQuery.isError) {
    return (
      <DashboardError
        message={leadsQuery.error instanceof Error ? leadsQuery.error.message : undefined}
        onRetry={() => leadsQuery.refetch()}
      />
    );
  }

  const leadsData = leadsQuery.data as LeadListResponse;
  const meta: Meta = leadsData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your sales leads and track their progress
          </p>
        </div>
        <RequirePermission permission={CRM_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Lead
          </Button>
        </RequirePermission>
      </div>

      <LeadTable
        leads={leadsData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={leadsQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onView={setViewLead}
        onEdit={canUpdate ? setEditLead : undefined}
        onDelete={canDelete ? setDeleteLead : undefined}
        onStatusChange={canUpdate ? setStatusLead : undefined}
        onAssign={canUpdate ? setAssignLead : undefined}
        onActivity={canCreate ? setActivityLead : undefined}
      />

      <CreateLeadDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={invalidate} />
      <EditLeadDialog lead={editLead} open={editLead !== null} onClose={() => setEditLead(null)} onUpdated={invalidate} />
      <LeadDetailsDialog lead={viewLead} open={viewLead !== null} onClose={() => setViewLead(null)} />
      <DeleteLeadDialog lead={deleteLead} open={deleteLead !== null} onClose={() => setDeleteLead(null)} onDeleted={invalidate} />
      <ChangeStatusDialog lead={statusLead} open={statusLead !== null} onClose={() => setStatusLead(null)} onStatusChanged={invalidate} />
      <AssignUserDialog lead={assignLead} open={assignLead !== null} onClose={() => setAssignLead(null)} onAssigned={invalidate} />
      <CreateActivityDialog
        leadId={activityLead?.id ?? ''}
        leadLabel={activityLead ? `${activityLead.leadNumber} - ${activityLead.name}` : ''}
        open={activityLead !== null}
        onClose={() => setActivityLead(null)}
        onCreated={invalidate}
      />
    </div>
  );
}
