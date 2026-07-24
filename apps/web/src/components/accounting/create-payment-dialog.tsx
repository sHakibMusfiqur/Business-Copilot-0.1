'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createPayment, getCustomers, getSuppliers } from '@/lib/api';

const schema = z.object({
  type: z.enum(['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT']),
  amount: z.number().min(0.01, 'Amount must be at least 0.01'),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
});

interface CreatePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePaymentDialog({ open, onClose, onCreated }: CreatePaymentDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState<string>('CUSTOMER_PAYMENT');
  const [customerId, setCustomerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const customersQuery = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => getCustomers({ limit: 100 }),
    enabled: open,
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => getSuppliers({ limit: 100 }),
    enabled: open,
  });

  const customers: Array<{ id: string; name: string }> = customersQuery.data?.data ?? [];
  const suppliers: Array<{ id: string; name: string }> = suppliersQuery.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createPayment({
      type: type as 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT',
      customerId: customerId || undefined,
      supplierId: supplierId || undefined,
      amount: Number(amount),
      reference: reference || undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Payment recorded' });
      onCreated();
      handleClose();
    },
    onError: (error: unknown) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to record payment.', variant: 'destructive' });
    },
  });

  function handleClose() {
    setType('CUSTOMER_PAYMENT'); setCustomerId(''); setSupplierId(''); setAmount(''); setReference(''); setNotes(''); setErrors({}); onClose();
  }

  function handleSubmit() {
    const result = schema.safeParse({
      type,
      amount: Number(amount),
      customerId: type === 'CUSTOMER_PAYMENT' ? customerId || undefined : undefined,
      supplierId: type === 'SUPPLIER_PAYMENT' ? supplierId || undefined : undefined,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    if (type === 'CUSTOMER_PAYMENT' && !customerId) { toast({ title: 'Validation', description: 'Customer is required.', variant: 'destructive' }); return; }
    if (type === 'SUPPLIER_PAYMENT' && !supplierId) { toast({ title: 'Validation', description: 'Supplier is required.', variant: 'destructive' }); return; }
    setErrors({});
    createMutation.mutate();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Payment Type *</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2">
                <input type="radio" name="pay-type" value="CUSTOMER_PAYMENT" checked={type === 'CUSTOMER_PAYMENT'} onChange={(e) => setType(e.target.value)} />
                <span className="text-sm">Customer Payment</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="pay-type" value="SUPPLIER_PAYMENT" checked={type === 'SUPPLIER_PAYMENT'} onChange={(e) => setType(e.target.value)} />
                <span className="text-sm">Supplier Payment</span>
              </label>
            </div>
          </div>

          {type === 'CUSTOMER_PAYMENT' && (
            <div>
              <Label htmlFor="pay-customer">Customer *</Label>
              <select id="pay-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {type === 'SUPPLIER_PAYMENT' && (
            <div>
              <Label htmlFor="pay-supplier">Supplier *</Label>
              <select id="pay-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="pay-amount">Amount *</Label>
            <Input id="pay-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
          </div>

          <div>
            <Label htmlFor="pay-ref">Reference</Label>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check # or transaction ID" />
          </div>

          <div>
            <Label htmlFor="pay-notes">Notes</Label>
            <textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Optional notes..." />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : 'Record Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
