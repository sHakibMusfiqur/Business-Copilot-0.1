'use client';

import { useMutation } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { deleteJournalEntry } from '@/lib/api';
import type { JournalEntry } from './accounting-types';

interface DeleteJournalDialogProps {
  entry: JournalEntry | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteJournalDialog({ entry, open, onClose, onDeleted }: DeleteJournalDialogProps) {
  const { toast } = useToast();
  const delMutation = useMutation({
    mutationFn: () => {
      if (!entry) throw new Error('No entry selected');
      return deleteJournalEntry(entry.id);
    },
    onSuccess: () => { toast({ title: 'Journal entry deleted' }); onDeleted(); onClose(); },
    onError: (error: unknown) => { toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete.', variant: 'destructive' }); },
  });

  if (!open || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Delete Journal Entry</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-start gap-4 mb-6">
          <div className="rounded-full bg-destructive/10 p-2 shrink-0"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
          <div>
            <p className="text-sm font-medium mb-1">Delete {entry.entryNumber}?</p>
            <p className="text-sm text-muted-foreground">Only draft entries can be deleted. This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => delMutation.mutate()} disabled={delMutation.isPending}>
            {delMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Delete Entry'}
          </Button>
        </div>
      </div>
    </div>
  );
}
