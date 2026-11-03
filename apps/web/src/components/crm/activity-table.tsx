'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  MoreHorizontal,
  ClipboardList,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';

import type { CrmActivity, CrmListMeta } from '@/lib/api';
import { ACTIVITY_TYPE_STYLES } from './crm-types';

interface ActivityTableProps {
  activities: CrmActivity[];
  meta: CrmListMeta | null;
  search: string;
  isLoading: boolean;
  /** Activity ids with an in-flight toggle/update. */
  pendingIds: ReadonlySet<string>;
  canToggle: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onToggle: (activity: CrmActivity) => void;
  onEdit?: (activity: CrmActivity) => void;
  onDelete?: (activity: CrmActivity) => void;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No activities found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Nothing matches this view yet. Create a call, email, meeting or task to start tracking follow-ups.
      </p>
    </div>
  );
}

function linkedEntityLabel(activity: CrmActivity): { text: string; href?: string } {
  if (activity.lead) return { text: `${activity.lead.leadNumber} · ${activity.lead.name}`, href: `/crm/leads/${activity.lead.id}` };
  if (activity.deal) return { text: activity.deal.title };
  if (activity.company) return { text: activity.company.name };
  if (activity.contact) return { text: `${activity.contact.firstName} ${activity.contact.lastName}` };
  return { text: '\u2014' };
}

function isOverdue(activity: CrmActivity): boolean {
  if (activity.completed || !activity.dueDate) return false;
  const due = new Date(activity.dueDate);
  const now = new Date();
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dueDay < today;
}

export function ActivityTable({
  activities,
  meta,
  search,
  isLoading,
  pendingIds,
  canToggle,
  onSearchChange,
  onPageChange,
  onToggle,
  onEdit,
  onDelete,
}: ActivityTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, onSearchChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Search activities"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : activities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-[50px] p-4 text-left text-sm font-medium text-muted-foreground">Done</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Title</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Linked to</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Assignee</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Due</th>
                  <th className="w-[60px] p-4" />
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => {
                  const pending = pendingIds.has(activity.id);
                  const overdue = isOverdue(activity);
                  const linked = linkedEntityLabel(activity);

                  return (
                    <tr key={activity.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => onToggle(activity)}
                          disabled={!canToggle || pending}
                          aria-label={activity.completed ? `Mark ${activity.title} as not done` : `Mark ${activity.title} as done`}
                          aria-pressed={activity.completed}
                          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors disabled:opacity-50 ${
                            activity.completed
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-input bg-background hover:bg-accent'
                          }`}
                        >
                          {activity.completed && <Check className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="p-4">
                        <p className={`text-sm font-medium ${activity.completed ? 'text-muted-foreground line-through' : ''}`}>
                          {activity.title}
                        </p>
                        {activity.description && (
                          <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">{activity.description}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ACTIVITY_TYPE_STYLES[activity.type as keyof typeof ACTIVITY_TYPE_STYLES] ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {activity.type}
                        </span>
                      </td>
                      <td className="p-4">
                        {linked.href ? (
                          <a href={linked.href} className="text-sm text-primary hover:underline">
                            {linked.text}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">{linked.text}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{activity.assignedTo?.name ?? '\u2014'}</span>
                      </td>
                      <td className="p-4">
                        {activity.dueDate ? (
                          <span className={`text-sm ${overdue ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
                            {formatDate(activity.dueDate)}
                            {overdue && ' · overdue'}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No due date</span>
                        )}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${activity.title}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {onEdit && <DropdownMenuItem onClick={() => onEdit(activity)}>Edit activity</DropdownMenuItem>}
                            {onToggle && canToggle && (
                              <DropdownMenuItem disabled={pending} onClick={() => onToggle(activity)}>
                                {activity.completed ? 'Mark as not done' : 'Mark as done'}
                              </DropdownMenuItem>
                            )}
                            {onDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(activity)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Delete activity
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(1)} aria-label="First page">
              «
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">{meta.page} / {meta.totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.totalPages)} aria-label="Last page">
              »
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
