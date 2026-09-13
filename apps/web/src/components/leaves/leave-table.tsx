'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CalendarDays,
  Check,
  X,
  Eye,
  Pencil,
  Trash2,
  Ban,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Leave, LeaveListMeta } from '@/lib/api/leaves';
import { getLeaveTypeLabel, getLeaveStatusStyle, getLeaveStatusLabel, getDaysCount } from './leave-types';

interface LeaveTableProps {
  leaves: Leave[];
  meta: LeaveListMeta | null;
  search: string;
  statusFilter: string;
  typeFilter: string;
  sortBy: string;
  sortOrder: string;
  isLoading: boolean;
  canApprove: boolean;
  canReject: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onTypeChange: (type: string) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onApprove: (leave: Leave) => void;
  onReject: (leave: Leave) => void;
  onCancel: (leave: Leave) => void;
  onView: (leave: Leave) => void;
  onEdit: (leave: Leave) => void;
  onDelete: (leave: Leave) => void;
}

function SortIcon({ field, sortBy, sortOrder }: { field: string; sortBy: string; sortOrder: string }) {
  if (field !== sortBy) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
  return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function LeaveTable({
  leaves,
  meta,
  search,
  statusFilter,
  typeFilter,
  sortBy,
  sortOrder,
  isLoading,
  canApprove,
  canReject,
  canUpdate,
  canDelete,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onPageChange,
  onSort,
  onApprove,
  onReject,
  onCancel,
  onView,
  onEdit,
  onDelete,
}: LeaveTableProps) {
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
            placeholder="Search by name, email, or code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Types</option>
          <option value="ANNUAL">Annual</option>
          <option value="SICK">Sick</option>
          <option value="PERSONAL">Personal</option>
          <option value="MATERNITY">Maternity</option>
          <option value="PATERNITY">Paternity</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-10 w-24 bg-muted animate-pulse rounded" />
              <div className="h-5 w-16 bg-muted animate-pulse rounded" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded flex-1" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : leaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No leave requests found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {search ? 'Try adjusting your search.' : 'Create your first leave request to get started.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('type')}>
                        Type
                        <SortIcon field="type" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('startDate')}>
                        Duration
                        <SortIcon field="startDate" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Days</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <span className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => onSort('status')}>
                        Status
                        <SortIcon field="status" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave) => (
                    <tr key={leave.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {leave.employee.firstName[0]}{leave.employee.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">{leave.employee.firstName} {leave.employee.lastName}</p>
                            <p className="text-xs text-muted-foreground">{leave.employee.department?.name ?? 'No department'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                          {getLeaveTypeLabel(leave.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span className="text-xs">
                            {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{getDaysCount(leave.startDate, leave.endDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getLeaveStatusStyle(leave.status)}`}>
                          {getLeaveStatusLabel(leave.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{leave.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onView(leave)}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canUpdate && leave.status === 'PENDING' && (
                            <button
                              onClick={() => onEdit(leave)}
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canApprove && leave.status === 'PENDING' && (
                            <button
                              onClick={() => onApprove(leave)}
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {canReject && leave.status === 'PENDING' && (
                            <button
                              onClick={() => onReject(leave)}
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:bg-red-500/10"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && leave.status === 'PENDING' && (
                            <button
                              onClick={() => onDelete(leave)}
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:bg-red-500/10"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {canUpdate && (leave.status === 'PENDING' || leave.status === 'APPROVED') && (
                            <button
                              onClick={() => onCancel(leave)}
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-amber-600 hover:bg-amber-500/10"
                              title="Cancel"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(1)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">{meta.page} / {meta.totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.totalPages)}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
