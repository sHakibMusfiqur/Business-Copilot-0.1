'use client';

import { useCallback, useState } from 'react';
import {
  MoreHorizontal,
  Plus,
  GripVertical,
  Trophy,
  XCircle,
  Loader2,
  CalendarDays,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatCurrency } from '@/lib/utils';

import type { DealListItem, PipelineStage } from '@/lib/api';

interface DealsBoardProps {
  stages: PipelineStage[];
  deals: DealListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number } | null;
  isLoading: boolean;
  /** Deal ids with an in-flight stage move (shown as busy). */
  pendingIds: ReadonlySet<string>;
  /** Optimistic dealId → stageId overrides applied before the server confirms. */
  stageOverrides: ReadonlyMap<string, string>;
  canCreate: boolean;
  canUpdate: boolean;
  onCreateInStage: (stage: PipelineStage) => void;
  onMove: (deal: DealListItem, stage: PipelineStage) => void;
  onEdit: (deal: DealListItem) => void;
  onDelete?: (deal: DealListItem) => void;
}

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 min-h-[220px]">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function DealsBoard({
  stages,
  deals,
  meta,
  isLoading,
  pendingIds,
  stageOverrides,
  canCreate,
  canUpdate,
  onCreateInStage,
  onMove,
  onEdit,
  onDelete,
}: DealsBoardProps) {
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const effectiveStageId = useCallback(
    (deal: DealListItem): string | null => stageOverrides.get(deal.id) ?? deal.stageId,
    [stageOverrides],
  );

  const grouped = new Map<string, DealListItem[]>();
  for (const stage of stages) grouped.set(stage.id, []);
  const unassigned: DealListItem[] = [];

  for (const deal of deals) {
    const stageId = effectiveStageId(deal);
    const bucket = stageId != null ? grouped.get(stageId) : undefined;
    if (bucket) bucket.push(deal);
    else if (stageId == null) unassigned.push(deal);
    // Deals moved optimistically to a stage not on this board are ignored
  }

  const handleDrop = useCallback(
    (stage: PipelineStage, event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOverStageId(null);
      setDraggedDealId(null);
      if (!canUpdate) return;

      const dealId = event.dataTransfer.getData('text/plain');
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) return;
      if (effectiveStageId(deal) === stage.id) return;
      onMove(deal, stage);
    },
    [canUpdate, deals, effectiveStageId, onMove],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ColumnSkeleton key={i} />
        ))}
      </div>
    );
  }

  const columns: Array<{ key: string; stage: PipelineStage | null; items: DealListItem[] }> = [
    ...(unassigned.length > 0 ? [{ key: 'unassigned', stage: null, items: unassigned }] : []),
    ...stages.map((stage) => ({ key: stage.id, stage, items: grouped.get(stage.id) ?? [] })),
  ];

  return (
    <div>
      {meta && meta.total > deals.length && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing {deals.length} of {meta.total} deals in this pipeline. Refine with search to see the rest.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {columns.map(({ key, stage, items }) => {
          const isWonColumn = stage?.isWon === true;
          const isLostColumn = stage?.isLost === true;
          const isDropTarget = stage != null && dragOverStageId === stage.id && draggedDealId != null;
          const columnTotal = items.reduce((sum, d) => sum + d.value, 0);

          return (
            <div
              key={key}
              data-stage-column={key}
              className={`flex flex-col rounded-xl border p-3 transition-colors min-h-[220px] ${
                isDropTarget
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                  : isWonColumn
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : isLostColumn
                      ? 'border-red-500/40 bg-red-500/5'
                      : 'bg-muted/20'
              }`}
              onDragOver={(event) => {
                if (!canUpdate || stage == null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverStageId(stage.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverStageId((prev) => (prev === key ? null : prev));
                }
              }}
              onDrop={(event) => {
                if (stage == null) return;
                handleDrop(stage, event);
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isWonColumn && <Trophy className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    {isLostColumn && <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />}
                    <h3 className="truncate text-sm font-semibold">
                      {stage ? stage.name : 'No stage'}
                      <span className="ml-1.5 font-normal text-muted-foreground">({items.length})</span>
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatCurrency(columnTotal)}</p>
                </div>
                {stage != null && canCreate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={`Create deal in ${stage.name}`}
                    onClick={() => onCreateInStage(stage)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    {stage == null
                      ? 'All deals are assigned to a stage.'
                      : canUpdate
                        ? 'Drop a deal here or use the card menu.'
                        : 'No deals in this stage.'}
                  </p>
                )}

                {items.map((deal) => {
                  const pending = pendingIds.has(deal.id);
                  const relatedName =
                    deal.companyRecord?.name ??
                    [deal.contact?.firstName, deal.contact?.lastName].filter(Boolean).join(' ') ??
                    deal.lead?.name ??
                    null;

                  return (
                    <div
                      key={deal.id}
                      draggable={canUpdate && !pending}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', deal.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDraggedDealId(deal.id);
                      }}
                      onDragEnd={() => {
                        setDraggedDealId(null);
                        setDragOverStageId(null);
                      }}
                      className={`group relative rounded-lg border bg-card p-3 shadow-sm transition ${
                        canUpdate ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${pending ? 'opacity-60' : ''} ${draggedDealId === deal.id ? 'ring-2 ring-primary/40' : ''}`}
                    >
                      {pending && (
                        <div className="absolute right-2 top-2" aria-label="Moving deal">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(deal)}
                          disabled={!canUpdate}
                          className="text-left text-sm font-medium leading-snug hover:underline disabled:no-underline"
                          aria-label={`Edit deal ${deal.title}`}
                        >
                          {deal.title}
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {canUpdate && stage != null && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={`Move deal ${deal.title} to another stage`}
                                  disabled={pending}
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {stages
                                  .filter((s) => s.id !== effectiveStageId(deal))
                                  .map((s) => (
                                    <DropdownMenuItem
                                      key={s.id}
                                      disabled={pending}
                                      onClick={() => onMove(deal, s)}
                                    >
                                      {s.isWon && <Trophy className="mr-2 h-3.5 w-3.5 text-emerald-600" />}
                                      {s.isLost && <XCircle className="mr-2 h-3.5 w-3.5 text-red-600" />}
                                      {s.name}
                                    </DropdownMenuItem>
                                  ))}
                                {stages.filter((s) => s.id !== effectiveStageId(deal)).length === 0 && (
                                  <DropdownMenuItem disabled>No other stages</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Actions for deal ${deal.title}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {canUpdate && (
                                <DropdownMenuItem onClick={() => onEdit(deal)}>Edit deal</DropdownMenuItem>
                              )}
                              {onDelete && (
                                <DropdownMenuItem onClick={() => onDelete(deal)} className="text-destructive focus:text-destructive">
                                  Delete deal
                                </DropdownMenuItem>
                              )}
                              {!canUpdate && <DropdownMenuItem disabled>View only</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{formatCurrency(deal.value)}</span>
                        <span className="text-xs text-muted-foreground">{deal.probability}% prob.</span>
                      </div>

                      {relatedName && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{relatedName}</p>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{deal.owner?.name ?? 'Unassigned'}</span>
                        {deal.expectedCloseDate && (
                          <span className="flex shrink-0 items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(deal.expectedCloseDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
