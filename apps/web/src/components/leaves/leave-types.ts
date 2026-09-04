export const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Annual Leave' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'PERSONAL', label: 'Personal Leave' },
  { value: 'MATERNITY', label: 'Maternity Leave' },
  { value: 'PATERNITY', label: 'Paternity Leave' },
  { value: 'UNPAID', label: 'Unpaid Leave' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const LEAVE_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'APPROVED', label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-muted text-muted-foreground' },
] as const;

export function getLeaveTypeLabel(type: string): string {
  return LEAVE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function getLeaveStatusStyle(status: string): string {
  return LEAVE_STATUSES.find((s) => s.value === status)?.color ?? 'bg-muted text-muted-foreground';
}

export function getLeaveStatusLabel(status: string): string {
  return LEAVE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getDaysCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
}
