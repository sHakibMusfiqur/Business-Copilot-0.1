'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { updateAccount } from '@/lib/api';
import type { Account } from './accounting-types';

interface EditAccountDialogProps {
  account: Account | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditAccountDialog({ account, open, onClose, onUpdated }: EditAccountDialogProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (account) {
      setCode(account.code);
      setName(account.name);
      setType(account.type);
      setDescription(account.description ?? '');
    }
  }, [account]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!account) throw new Error('No account selected');
      return updateAccount(account.id, {
        code, name, type: type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE', description: description || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Account updated' });
      onUpdated(); onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message ?? 'Failed to update account.', variant: 'destructive' });
    },
  });

  if (!open || !account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Edit Account</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-code">Code</Label>
              <Input id="edit-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-type">Type</Label>
              <select id="edit-type" value={type} onChange={(e) => setType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-desc">Description</Label>
            <textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
