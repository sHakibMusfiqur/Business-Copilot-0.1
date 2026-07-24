'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createAccount, getAccounts } from '@/lib/api';

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], { required_error: 'Type is required' }),
  parentId: z.string().optional(),
  description: z.string().optional(),
});

interface CreateAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateAccountDialog({ open, onClose, onCreated }: CreateAccountDialogProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accountsQuery = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => getAccounts({ limit: 200 }),
    enabled: open,
  });

  const accounts: Array<{ id: string; code: string; name: string; type: string }> = accountsQuery.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createAccount({
      code, name, type: type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE', parentId: parentId || undefined, description: description || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Account created' });
      onCreated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message ?? 'Failed to create account.', variant: 'destructive' });
    },
  });

  function handleClose() {
    setCode(''); setName(''); setType(''); setParentId(''); setDescription(''); setErrors({}); onClose();
  }

  function handleSubmit() {
    const result = schema.safeParse({ code, name, type, parentId: parentId || undefined, description: description || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    createMutation.mutate();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create Account</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Code *</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 1100" />
              {errors.code && <p className="text-xs text-destructive mt-1">{errors.code}</p>}
            </div>
            <div>
              <Label htmlFor="acct-type">Type *</Label>
              <select id="acct-type" value={type} onChange={(e) => setType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select type</option>
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expense</option>
              </select>
              {errors.type && <p className="text-xs text-destructive mt-1">{errors.type}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="acct-name">Name *</Label>
            <Input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="parent">Parent Account</Label>
            <select id="parent" value={parentId} onChange={(e) => setParentId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">None (top-level)</option>
              {accounts.filter((a) => a.id !== parentId).map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Account'}
          </Button>
        </div>
      </div>
    </div>
  );
}
