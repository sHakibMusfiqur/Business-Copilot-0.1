'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2, Plus as PlusIcon, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createJournalEntry, getAccounts } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface LineRow {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

let rowIdCounter = 0;
function newRowId(): string {
  rowIdCounter += 1;
  return `jl_${rowIdCounter}`;
}

function emptyLine(): LineRow {
  return { id: newRowId(), accountId: '', debit: '0', credit: '0', description: '' };
}

interface CreateJournalDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateJournalDialog({ open, onClose, onCreated }: CreateJournalDialogProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [referenceType, setReferenceType] = useState('');
  const [lines, setLines] = useState<LineRow[]>([emptyLine(), emptyLine()]);

  const accountsQuery = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => getAccounts({ limit: 200 }),
    enabled: open,
  });

  const accounts: Array<{ id: string; code: string; name: string }> = accountsQuery.data?.data ?? [];

  const debitTotal = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01;
  const imbalance = debitTotal - creditTotal;

  const createMutation = useMutation({
    mutationFn: () => createJournalEntry({
      description,
      referenceId: referenceId || undefined,
      referenceType: referenceType || undefined,
      lines: lines.filter((l) => l.accountId).map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      })),
    }),
    onSuccess: () => {
      toast({ title: 'Journal entry created' });
      onCreated();
      handleClose();
    },
    onError: (error: unknown) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create journal entry.', variant: 'destructive' });
    },
  });

  function handleClose() {
    setDescription('');
    setReferenceId('');
    setReferenceType('');
    setLines([emptyLine(), emptyLine()]);
    onClose();
  }

  function addLine() { setLines((prev) => [...prev, emptyLine()]); }

  function removeLine(id: string) { setLines((prev) => prev.filter((r) => r.id !== id)); }

  function updateLine(id: string, field: keyof LineRow, value: string) {
    setLines((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function handleSubmit() {
    if (!description.trim()) { toast({ title: 'Validation', description: 'Description is required.', variant: 'destructive' }); return; }
    if (!isBalanced) { toast({ title: 'Validation', description: `Journal is not balanced. Difference: ${formatCurrency(Math.abs(imbalance))}`, variant: 'destructive' }); return; }
    const validLines = lines.filter((l) => l.accountId);
    if (validLines.length < 2) { toast({ title: 'Validation', description: 'At least 2 lines are required.', variant: 'destructive' }); return; }
    createMutation.mutate();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-4xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create Journal Entry</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="je-desc">Description *</Label>
            <Input id="je-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Journal entry description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="je-ref-id">Reference ID</Label>
              <Input id="je-ref-id" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="e.g. INV-001" />
            </div>
            <div>
              <Label htmlFor="je-ref-type">Reference Type</Label>
              <select id="je-ref-type" value={referenceType} onChange={(e) => setReferenceType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">None</option>
                <option value="SALES">Sales Order</option>
                <option value="PURCHASE">Purchase Order</option>
                <option value="PAYMENT">Payment</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <Label>Journal Lines *</Label>
          <Button variant="outline" size="sm" onClick={addLine} className="gap-1"><PlusIcon className="h-3 w-3" /> Add Line</Button>
        </div>

        <div className="rounded-lg border mb-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground w-[40%]">Account</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-[15%]">Debit</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-[15%]">Credit</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground w-[25%]">Description</th>
                <th className="w-[5%] p-3" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b last:border-b-0">
                  <td className="p-2">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(line.id, 'accountId', e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                    >
                      <option value="">Select account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number" min="0" step="0.01"
                      value={line.debit}
                      onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number" min="0" step="0.01"
                      value={line.credit}
                      onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      placeholder="Optional"
                      className="h-9"
                    />
                  </td>
                  <td className="p-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" disabled={lines.length <= 2} onClick={() => removeLine(line.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`rounded-lg p-3 mb-4 text-sm font-mono flex items-center justify-between ${isBalanced ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
          <span>Debit Total: {formatCurrency(debitTotal)}</span>
          <span>Credit Total: {formatCurrency(creditTotal)}</span>
          <span>
            {isBalanced ? 'Balanced' : `Imbalance: ${formatCurrency(Math.abs(imbalance))}`}
          </span>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || !isBalanced}>
            {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Entry'}
          </Button>
        </div>
      </div>
    </div>
  );
}
