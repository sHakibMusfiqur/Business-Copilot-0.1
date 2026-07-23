'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { updateSupplier } from '@/lib/api';
import type { Supplier } from './supplier-types';

const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

interface EditSupplierDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditSupplierDialog({ supplier, open, onClose, onUpdated }: EditSupplierDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setCompany(supplier.company ?? '');
      setEmail(supplier.email ?? '');
      setPhone(supplier.phone ?? '');
      setTaxId(supplier.taxId ?? '');
      setAddress(supplier.address ?? '');
      setNotes(supplier.notes ?? '');
    }
  }, [supplier]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!supplier) throw new Error('No supplier selected');
      return updateSupplier(supplier.id, {
        name,
        company: company || undefined,
        email: email || undefined,
        phone: phone || undefined,
        taxId: taxId || undefined,
        address: address || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Supplier updated' });
      onUpdated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update supplier.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setTaxId('');
    setAddress('');
    setNotes('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const result = updateSupplierSchema.safeParse({ name });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    updateMutation.mutate();
  }

  if (!open || !supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Edit Supplier</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Supply Co"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supplier@company.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div>
              <Label htmlFor="edit-taxId">Tax/VAT ID</Label>
              <Input
                id="edit-taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="TAX-12345"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-address">Address</Label>
            <Input
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City"
            />
          </div>

          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
