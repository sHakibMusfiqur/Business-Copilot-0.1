'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { CompanyTable } from '@/components/crm/company-table';
import { CompanyDialog } from '@/components/crm/company-dialog';
import { CompanyDetailsDialog } from '@/components/crm/company-details-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RequirePermission } from '@/components/rbac/require-permission';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_READ, CRM_CREATE, CRM_UPDATE, CRM_DELETE } from '@/lib/permissions';
import { getCompanies, deleteCompany } from '@/lib/api';
import type { CompanyListItem, CrmListMeta } from '@/lib/api';

interface CompanyListResponse {
  data: CompanyListItem[];
  meta: CrmListMeta;
}

export default function CrmCompaniesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(CRM_READ);
  const canUpdate = isLoaded && hasPermission(CRM_UPDATE);
  const canDelete = isLoaded && hasPermission(CRM_DELETE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<CompanyListItem | null>(null);
  const [viewCompanyId, setViewCompanyId] = useState<string | null>(null);
  const [viewCompanyRow, setViewCompanyRow] = useState<CompanyListItem | null>(null);
  const [deleteCompanyRow, setDeleteCompanyRow] = useState<CompanyListItem | null>(null);

  const companiesQuery = useQuery<CompanyListResponse>({
    queryKey: ['crm', 'companies', { page, limit, search, sortBy, sortOrder }],
    queryFn: ({ signal }) =>
      getCompanies({ page, limit, search: search || undefined, sortBy, sortOrder }, signal),
    enabled: canRead,
  });

  const invalidate = useCallback(() => {
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
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleView = useCallback((company: CompanyListItem) => {
    setViewCompanyId(company.id);
    setViewCompanyRow(company);
  }, []);

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view CRM companies. Contact your organization administrator."
      />
    );
  }

  if (companiesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (companiesQuery.isError) {
    return (
      <DashboardError
        message={companiesQuery.error instanceof Error ? companiesQuery.error.message : undefined}
        onRetry={() => companiesQuery.refetch()}
      />
    );
  }

  const companiesData = companiesQuery.data as CompanyListResponse;
  const meta: CrmListMeta = companiesData.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track organizations you sell to and their linked contacts and deals
          </p>
        </div>
        <RequirePermission permission={CRM_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Company
          </Button>
        </RequirePermission>
      </div>

      <CompanyTable
        companies={companiesData.data}
        meta={meta}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isLoading={companiesQuery.isLoading}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onSort={handleSort}
        onView={handleView}
        onEdit={canUpdate ? setEditCompany : undefined}
        onDelete={canDelete ? setDeleteCompanyRow : undefined}
      />

      <CompanyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={invalidate}
      />
      <CompanyDialog
        open={editCompany !== null}
        company={editCompany}
        onClose={() => setEditCompany(null)}
        onSaved={invalidate}
      />
      <CompanyDetailsDialog
        companyId={viewCompanyId}
        company={viewCompanyRow}
        open={viewCompanyId !== null}
        onClose={() => {
          setViewCompanyId(null);
          setViewCompanyRow(null);
        }}
      />
      <ConfirmDeleteDialog
        entityName={deleteCompanyRow?.name ?? null}
        title="Delete Company"
        description={`This will soft-delete the company "${deleteCompanyRow?.name ?? ''}" and detach it from related records. This action cannot be undone.`}
        buttonLabel="Delete Company"
        successTitle="Company deleted"
        errorFallback="Failed to delete company."
        open={deleteCompanyRow !== null}
        onClose={() => setDeleteCompanyRow(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteCompany(deleteCompanyRow?.id ?? '')}
      />
    </div>
  );
}
