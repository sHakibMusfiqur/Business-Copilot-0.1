'use client';

import { CalendarDays, Check, X, Eye, Pencil } from 'lucide-react';

import type { Leave } from '@/lib/api/leaves';
import { getLeaveTypeLabel, getLeaveStatusStyle, getLeaveStatusLabel, getDaysCount } from './leave-types';

interface LeaveTableProps {
  leaves: Leave[];
  canApprove: boolean;
  canReject: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onApprove: (leave: Leave) => void;
  onReject: (leave: Leave) => void;
  onView: (leave: Leave) => void;
  onEdit: (leave: Leave) => void;
  onDelete: (leave: Leave) => void;
}

export function LeaveTable({ leaves, canApprove, canReject, canUpdate, canDelete, onApprove, onReject, onView, onEdit, onDelete }: LeaveTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Duration</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Days</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
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
                    {canDelete && leave.status !== 'APPROVED' && (
                      <button
                        onClick={() => onDelete(leave)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <X className="h-4 w-4" />
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
  );
}
