'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { updateInvoice, getCustomers } from '@/lib/api';
import type { Invoice } from './invoices-types';

const updateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

interface EditInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditInvoiceDialog({ invoice, open, onClose, onUpdated }: EditInvoiceDialogProps) {
  const { toast } = useToast();

  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const customersQuery = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => getCustomers({ limit: 100 }),
    enabled: open,
  });

  const customers: Array<{ id: string; name: string }> = customersQuery.data?.data ?? [];

  useEffect(() => {
    if (invoice) {
      setCustomerId(invoice.customer?.id ?? '');
      setIssueDate(invoice.issueDate ? invoice.issueDate.split('T')[0] : '');
      setDueDate(invoice.dueDate ? invoice.dueDate.split('T')[0] : '');
      setNotes(invoice.notes ?? '');
    }
  }, [invoice]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!invoice) throw new Error('No invoice selected');
      return updateInvoice(invoice.id, {
        customerId: customerId || undefined,
        issueDate: issueDate || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Invoice updated' });
      onUpdated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update invoice.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setCustomerId('');
    setIssueDate('');
    setDueDate('');
    setNotes('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const result = updateSchema.safeParse({ customerId, issueDate, dueDate: dueDate || undefined, notes: notes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    updateMutation.mutate();
  }

  if (!open || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Edit Invoice</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-customer">Customer *</Label>
            <select
              id="edit-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.customerId && <p className="text-xs text-destructive mt-1">{errors.customerId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-issue-date">Issue Date *</Label>
              <Input
                id="edit-issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
              {errors.issueDate && <p className="text-xs text-destructive mt-1">{errors.issueDate}</p>}
            </div>
            <div>
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice notes..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
