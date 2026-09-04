'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Leave } from '@/lib/api/leaves';
import { getLeaveTypeLabel, getLeaveStatusStyle, getLeaveStatusLabel, getDaysCount } from './leave-types';

interface LeaveDetailsDialogProps {
  leave: Leave | null;
  open: boolean;
  onClose: () => void;
}

export function LeaveDetailsDialog({ leave, open, onClose }: LeaveDetailsDialogProps) {
  if (!leave) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leave Request Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {leave.employee.firstName[0]}{leave.employee.lastName[0]}
            </div>
            <div>
              <p className="font-medium">{leave.employee.firstName} {leave.employee.lastName}</p>
              <p className="text-xs text-muted-foreground">{leave.employee.employeeCode}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">{getLeaveTypeLabel(leave.type)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getLeaveStatusStyle(leave.status)}`}>
                {getLeaveStatusLabel(leave.status)}
              </span>
            </div>
            <div>
              <p className="text-muted-foreground">Start Date</p>
              <p className="font-medium">{new Date(leave.startDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">End Date</p>
              <p className="font-medium">{new Date(leave.endDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-medium">{getDaysCount(leave.startDate, leave.endDate)} day(s)</p>
            </div>
            <div>
              <p className="text-muted-foreground">Department</p>
              <p className="font-medium">{leave.employee.department?.name ?? '—'}</p>
            </div>
          </div>

          {leave.reason && (
            <div>
              <p className="text-muted-foreground text-sm">Reason</p>
              <p className="text-sm">{leave.reason}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Submitted on {new Date(leave.createdAt).toLocaleString()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
