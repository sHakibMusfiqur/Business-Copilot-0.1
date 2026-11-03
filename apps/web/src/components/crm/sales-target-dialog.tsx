'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createSalesTarget, updateSalesTarget, getOrganizationUsers } from '@/lib/api';
import type { SalesTarget } from '@/lib/api';

const targetSchema = z
  .object({
    periodStart: z.string().min(1, 'Start date is required'),
    periodEnd: z.string().min(1, 'End date is required'),
    amount: z.coerce
      .number({ invalid_type_error: 'Amount must be a number' })
      .min(0, 'Amount must be 0 or more'),
    ownerId: z.string(),
    notes: z.string().max(500),
  })
  .refine((values) => values.periodStart <= values.periodEnd, {
    message: 'Start date must be on or before end date',
    path: ['periodEnd'],
  });

type TargetFormValues = z.infer<typeof targetSchema>;

interface SalesTargetDialogProps {
  open: boolean;
  /** When set, the dialog edits this target instead of creating one. */
  target?: SalesTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_VALUES: TargetFormValues = {
  periodStart: '',
  periodEnd: '',
  amount: 0,
  ownerId: '',
  notes: '',
};

function toFormValues(target: SalesTarget | null | undefined): TargetFormValues {
  if (!target) return EMPTY_VALUES;
  return {
    periodStart: target.periodStart.slice(0, 10),
    periodEnd: target.periodEnd.slice(0, 10),
    amount: target.amount,
    ownerId: target.ownerId ?? '',
    notes: target.notes ?? '',
  };
}

export function SalesTargetDialog({ open, target, onClose, onSaved }: SalesTargetDialogProps) {
  const { toast } = useToast();
  const isEdit = target != null;

  const [values, setValues] = useState<TargetFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(toFormValues(target));
      setErrors({});
    }
  }, [open, target]);

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: open,
  });
  const users = usersQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const parsed = targetSchema.parse(values);
      const payload = {
        periodStart: new Date(parsed.periodStart).toISOString(),
        periodEnd: new Date(parsed.periodEnd).toISOString(),
        amount: parsed.amount,
        ownerId: parsed.ownerId || null,
        notes: parsed.notes.trim() || null,
      };
      return isEdit && target ? updateSalesTarget(target.id, payload) : createSalesTarget(payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Target updated' : 'Target created' });
      onSaved();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to save sales target.',
        variant: 'destructive',
      });
    },
  });

  function setField<K extends keyof TargetFormValues>(key: K, value: TargetFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const result = targetSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    saveMutation.mutate();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit sales target' : 'Create sales target'}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Sales Target' : 'Create Sales Target'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="target-start">Period Start *</Label>
            <Input
              id="target-start"
              type="date"
              value={values.periodStart}
              onChange={(e) => setField('periodStart', e.target.value)}
              aria-invalid={errors.periodStart ? true : undefined}
            />
            {errors.periodStart && <p className="text-xs text-destructive mt-1">{errors.periodStart}</p>}
          </div>
          <div>
            <Label htmlFor="target-end">Period End *</Label>
            <Input
              id="target-end"
              type="date"
              value={values.periodEnd}
              onChange={(e) => setField('periodEnd', e.target.value)}
              aria-invalid={errors.periodEnd ? true : undefined}
            />
            {errors.periodEnd && <p className="text-xs text-destructive mt-1">{errors.periodEnd}</p>}
          </div>
          <div>
            <Label htmlFor="target-amount">Amount *</Label>
            <Input
              id="target-amount"
              type="number"
              min={0}
              step="0.01"
              value={values.amount}
              onChange={(e) => setField('amount', Number(e.target.value))}
            />
            {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
          </div>
          <div>
            <Label htmlFor="target-owner">Owner</Label>
            <select
              id="target-owner"
              value={values.ownerId}
              onChange={(e) => setField('ownerId', e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Organization-wide</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {errors.ownerId && <p className="text-xs text-destructive mt-1">{errors.ownerId}</p>}
          </div>
          <div className="col-span-2">
            <Label htmlFor="target-notes">Notes</Label>
            <textarea
              id="target-notes"
              value={values.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Target notes..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes}</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Create Target'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
