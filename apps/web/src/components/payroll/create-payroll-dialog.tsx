'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createPayroll } from '@/lib/api/payroll';
import { getEmployees, type Employee } from '@/lib/api/employees';

interface CreatePayrollDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePayrollDialog({ open, onClose, onCreated }: CreatePayrollDialogProps) {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [tax, setTax] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ['employees', { isActive: true }],
    queryFn: () => getEmployees({ isActive: true }),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => createPayroll({
      employeeId,
      periodStart,
      periodEnd,
      basicSalary: parseFloat(basicSalary),
      allowances: allowances ? parseFloat(allowances) : undefined,
      deductions: deductions ? parseFloat(deductions) : undefined,
      tax: tax ? parseFloat(tax) : undefined,
      paymentDate: paymentDate || undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Payroll record created' });
      onCreated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create payroll record.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setEmployeeId('');
    setPeriodStart('');
    setPeriodEnd('');
    setBasicSalary('');
    setAllowances('');
    setDeductions('');
    setTax('');
    setPaymentDate('');
    setNotes('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!employeeId) newErrors.employeeId = 'Employee is required';
    if (!periodStart) newErrors.periodStart = 'Period start is required';
    if (!periodEnd) newErrors.periodEnd = 'Period end is required';
    if (periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd)) {
      newErrors.periodEnd = 'Period end must be after period start';
    }
    if (!basicSalary || parseFloat(basicSalary) < 0) newErrors.basicSalary = 'Valid salary is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    createMutation.mutate();
  }

  if (!open) return null;

  const employees = employeesQuery.data ?? [];
  const netSalary = (parseFloat(basicSalary) || 0) + (parseFloat(allowances) || 0) - (parseFloat(deductions) || 0) - (parseFloat(tax) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create Payroll Record</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="employeeId">Employee *</Label>
            <select
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${errors.employeeId ? 'border-destructive' : 'border-border'}`}
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode})
                </option>
              ))}
            </select>
            {errors.employeeId && <p className="text-xs text-destructive mt-1">{errors.employeeId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="periodStart">Period Start *</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className={errors.periodStart ? 'border-destructive' : ''}
              />
              {errors.periodStart && <p className="text-xs text-destructive mt-1">{errors.periodStart}</p>}
            </div>
            <div>
              <Label htmlFor="periodEnd">Period End *</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className={errors.periodEnd ? 'border-destructive' : ''}
              />
              {errors.periodEnd && <p className="text-xs text-destructive mt-1">{errors.periodEnd}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="basicSalary">Basic Salary *</Label>
            <Input
              id="basicSalary"
              type="number"
              min="0"
              step="0.01"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              placeholder="0"
              className={errors.basicSalary ? 'border-destructive' : ''}
            />
            {errors.basicSalary && <p className="text-xs text-destructive mt-1">{errors.basicSalary}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="allowances">Allowances</Label>
              <Input
                id="allowances"
                type="number"
                min="0"
                step="0.01"
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="deductions">Deductions</Label>
              <Input
                id="deductions"
                type="number"
                min="0"
                step="0.01"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="tax">Tax</Label>
              <Input
                id="tax"
                type="number"
                min="0"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">Net Salary: <span className="font-medium text-foreground">{netSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
          </div>

          <div>
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring min-h-[60px]"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Record'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
