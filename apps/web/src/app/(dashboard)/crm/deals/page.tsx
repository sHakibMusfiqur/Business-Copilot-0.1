'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Workflow, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { RequirePermission } from '@/components/rbac/require-permission';
import { useToast } from '@/components/ui/use-toast';
import { DealsBoard } from '@/components/crm/deals-board';
import { DealDialog } from '@/components/crm/deal-dialog';
import { LostReasonDialog } from '@/components/crm/lost-reason-dialog';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_READ, CRM_CREATE, CRM_UPDATE, CRM_DELETE } from '@/lib/permissions';
import {
  getDeals,
  deleteDeal,
  moveDealStage,
  getPipelines,
  getPipelineStages,
} from '@/lib/api';
import type { DealListItem, CrmListMeta, PipelineStage } from '@/lib/api';

interface DealListResponse {
  data: DealListItem[];
  meta: CrmListMeta;
}

interface MoveVars {
  dealId: string;
  stageId: string;
  lostReason?: string;
}

export default function CrmDealsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isLoaded } = usePermissions();

  const canRead = isLoaded && hasPermission(CRM_READ);
  const canCreate = isLoaded && hasPermission(CRM_CREATE);
  const canUpdate = isLoaded && hasPermission(CRM_UPDATE);
  const canDelete = isLoaded && hasPermission(CRM_DELETE);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStage, setCreateStage] = useState<PipelineStage | null>(null);
  const [editDeal, setEditDeal] = useState<DealListItem | null>(null);
  const [deleteDealRow, setDeleteDealRow] = useState<DealListItem | null>(null);
  const [lostPrompt, setLostPrompt] = useState<{ deal: DealListItem; stage: PipelineStage } | null>(null);

  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [stageOverrides, setStageOverrides] = useState<ReadonlyMap<string, string>>(() => new Map());

  // Debounce search so each keystroke doesn't fire a request
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => (prev === searchInput ? prev : searchInput));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const pipelinesQuery = useQuery({
    queryKey: ['crm', 'pipelines', 'board'],
    queryFn: ({ signal }) => getPipelines({ limit: 50 }, signal),
    enabled: canRead,
  });

  const pipelines = useMemo(() => pipelinesQuery.data?.data ?? [], [pipelinesQuery.data]);

  // Default to the active default pipeline, else the first active one
  useEffect(() => {
    if (pipelineId != null || pipelines.length === 0) return;
    const preferred =
      pipelines.find((p) => p.isDefault && p.isActive) ??
      pipelines.find((p) => p.isActive) ??
      pipelines[0];
    if (preferred) setPipelineId(preferred.id);
  }, [pipelines, pipelineId]);

  const stagesQuery = useQuery({
    queryKey: ['crm', 'pipelines', pipelineId, 'stages'],
    queryFn: ({ signal }) => getPipelineStages(pipelineId as string, signal),
    enabled: canRead && pipelineId != null,
  });

  const dealsQuery = useQuery<DealListResponse>({
    queryKey: ['crm', 'deals', 'board', { pipelineId, search }],
    queryFn: async ({ signal }) => {
      const baseParams = {
        pipelineId: pipelineId ?? undefined,
        search: search || undefined,
        // Backend max page size (QueryDealsDto.limit Max(200))
        limit: 200,
        sortBy: 'expectedCloseDate',
        sortOrder: 'asc' as const,
      };
      const first = await getDeals({ ...baseParams, page: 1 }, signal);
      const all: DealListItem[] = [...first.data];
      // Fetch every page so the board is not truncated at 200 records.
      // Safety cap bounds the request count for very large pipelines; the board
      // keeps showing the "Showing X of Y" notice when the cap is hit.
      const maxPages = Math.min(first.meta.totalPages, 10);
      for (let page = 2; page <= maxPages && all.length < first.meta.total; page++) {
        const next = await getDeals({ ...baseParams, page }, signal);
        all.push(...next.data);
      }
      return { data: all, meta: first.meta };
    },
    enabled: canRead && pipelineId != null,
  });

  const invalidateBoards = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  const clearPending = useCallback((dealId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(dealId);
      return next;
    });
    setStageOverrides((prev) => {
      if (!prev.has(dealId)) return prev;
      const next = new Map(prev);
      next.delete(dealId);
      return next;
    });
  }, []);

  const moveMutation = useMutation({
    mutationFn: (vars: MoveVars) =>
      moveDealStage(vars.dealId, {
        stageId: vars.stageId,
        ...(vars.lostReason ? { lostReason: vars.lostReason } : {}),
      }),
    onSuccess: (_data, vars) => {
      clearPending(vars.dealId);
      invalidateBoards();
    },
    onError: (error: Error, vars) => {
      clearPending(vars.dealId);
      invalidateBoards();
      toast({
        title: 'Move failed',
        description: error.message ?? 'The deal could not be moved.',
        variant: 'destructive',
      });
    },
  });

  const executeMove = useCallback(
    (deal: DealListItem, stage: PipelineStage, lostReason?: string) => {
      if (deal.stageId === stage.id) return;
      setPendingIds((prev) => new Set(prev).add(deal.id));
      setStageOverrides((prev) => {
        const next = new Map(prev);
        next.set(deal.id, stage.id);
        return next;
      });
      moveMutation.mutate({ dealId: deal.id, stageId: stage.id, lostReason });
    },
    [moveMutation],
  );

  const requestMove = useCallback(
    (deal: DealListItem, stage: PipelineStage) => {
      if (stage.isLost) {
        setLostPrompt({ deal, stage });
        return;
      }
      executeMove(deal, stage);
    },
    [executeMove],
  );

  const openCreate = useCallback(
    (stage: PipelineStage | null) => {
      setCreateStage(stage);
      setCreateOpen(true);
    },
    [],
  );

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view the deals pipeline. Contact your organization administrator."
      />
    );
  }

  if (pipelinesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (pipelinesQuery.isError) {
    return (
      <DashboardError
        message={pipelinesQuery.error instanceof Error ? pipelinesQuery.error.message : undefined}
        onRetry={() => pipelinesQuery.refetch()}
      />
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Workflow className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">No pipelines yet</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          A sales pipeline with stages is required before deals can be tracked. Pipelines are created
          automatically during organization provisioning.
        </p>
      </div>
    );
  }

  const stages: PipelineStage[] = stagesQuery.data ?? [];
  const dealsData = dealsQuery.data;
  const selectedPipeline = pipelines.find((p) => p.id === pipelineId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag deals between stages, or use the card menu for keyboard moves
          </p>
        </div>
        <RequirePermission permission={CRM_CREATE}>
          <Button
            onClick={() => openCreate(stages[0] ?? null)}
            className="gap-2"
            disabled={stagesQuery.isLoading}
          >
            <Plus className="h-4 w-4" />
            New Deal
          </Button>
        </RequirePermission>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="deal-pipeline-select">
          Pipeline
        </label>
        <select
          id="deal-pipeline-select"
          value={pipelineId ?? ''}
          onChange={(e) => setPipelineId(e.target.value || null)}
          className="flex h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isDefault ? ' (default)' : ''}
            </option>
          ))}
        </select>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deals in this pipeline..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Search deals"
          />
        </div>

        {stagesQuery.isLoading && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading stages...
          </span>
        )}
      </div>

      {stagesQuery.isError ? (
        <DashboardError
          message={stagesQuery.error instanceof Error ? stagesQuery.error.message : undefined}
          onRetry={() => stagesQuery.refetch()}
        />
      ) : dealsQuery.isError ? (
        <DashboardError
          message={dealsQuery.error instanceof Error ? dealsQuery.error.message : undefined}
          onRetry={() => dealsQuery.refetch()}
        />
      ) : (
        <DealsBoard
          stages={stages}
          deals={dealsData?.data ?? []}
          meta={dealsData?.meta ?? null}
          isLoading={stagesQuery.isLoading || dealsQuery.isLoading}
          pendingIds={pendingIds}
          stageOverrides={stageOverrides}
          canCreate={canCreate}
          canUpdate={canUpdate}
          onCreateInStage={(stage) => openCreate(stage)}
          onMove={requestMove}
          onEdit={setEditDeal}
          onDelete={canDelete ? setDeleteDealRow : undefined}
        />
      )}

      <DealDialog
        open={createOpen}
        pipelineId={selectedPipeline?.id ?? null}
        stage={createStage}
        onClose={() => setCreateOpen(false)}
        onSaved={invalidateBoards}
      />
      <DealDialog
        open={editDeal !== null}
        deal={editDeal}
        onClose={() => setEditDeal(null)}
        onSaved={invalidateBoards}
      />
      <LostReasonDialog
        open={lostPrompt !== null}
        dealTitle={lostPrompt?.deal.title ?? null}
        stageName={lostPrompt?.stage.name ?? null}
        isPending={lostPrompt != null && pendingIds.has(lostPrompt.deal.id)}
        onCancel={() => setLostPrompt(null)}
        onConfirm={(reason) => {
          if (!lostPrompt) return;
          const { deal, stage } = lostPrompt;
          setLostPrompt(null);
          executeMove(deal, stage, reason);
        }}
      />
      <ConfirmDeleteDialog
        entityName={deleteDealRow?.title ?? null}
        title="Delete Deal"
        description={`This will soft-delete the deal "${deleteDealRow?.title ?? ''}". This action cannot be undone.`}
        buttonLabel="Delete Deal"
        successTitle="Deal deleted"
        errorFallback="Failed to delete deal."
        open={deleteDealRow !== null}
        onClose={() => setDeleteDealRow(null)}
        onDeleted={invalidateBoards}
        deleteFn={() => deleteDeal(deleteDealRow?.id ?? '')}
      />
    </div>
  );
}
