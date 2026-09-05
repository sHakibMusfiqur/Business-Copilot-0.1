'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PayrollDetail } from '@/lib/api/payroll';
import { formatCurrency } from '@/lib/utils';

interface PayrollDetailsDialogProps {
  record: PayrollDetail | null;
  open: boolean;
  onClose: () => void;
}

export function PayrollDetailsDialog({ record, open, onClose }: PayrollDetailsDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payroll Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {record.employee.firstName[0]}{record.employee.lastName[0]}
            </div>
            <div>
              <p className="font-medium">{record.employee.firstName} {record.employee.lastName}</p>
              <p className="text-xs text-muted-foreground">{record.employee.employeeCode} · {record.employee.department?.name ?? 'No department'}</p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Salary Breakdown</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Basic Salary</p>
                <p className="font-medium">{formatCurrency(Number(record.basicSalary))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Allowances</p>
                <p className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(Number(record.allowances))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Deductions</p>
                <p className="font-medium text-red-600 dark:text-red-400">-{formatCurrency(Number(record.deductions))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tax</p>
                <p className="font-medium text-red-600 dark:text-red-400">-{formatCurrency(Number(record.tax))}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Net Salary</p>
                <p className="text-lg font-bold">{formatCurrency(Number(record.netSalary))}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Period</p>
              <p className="font-medium">{new Date(record.periodStart).toLocaleDateString()} — {new Date(record.periodEnd).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Date</p>
              <p className="font-medium">{record.paymentDate ? new Date(record.paymentDate).toLocaleDateString() : '—'}</p>
            </div>
            {record.employee.position && (
              <div>
                <p className="text-muted-foreground">Position</p>
                <p className="font-medium">{record.employee.position}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Employee Base Salary</p>
              <p className="font-medium">{formatCurrency(Number(record.employee.salary))}</p>
            </div>
          </div>

          {record.notes && (
            <div>
              <p className="text-muted-foreground text-sm">Notes</p>
              <p className="text-sm">{record.notes}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Created {new Date(record.createdAt).toLocaleString()}
            {record.updatedAt && ` · Updated ${new Date(record.updatedAt).toLocaleString()}`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
