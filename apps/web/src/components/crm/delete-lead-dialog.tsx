'use client';

import { useMutation } from '@tanstack/react-query';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { deleteLead } from '@/lib/api';
import type { LeadListItem } from './crm-types';

interface DeleteLeadDialogProps {
  lead: LeadListItem | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteLeadDialog({ lead, open, onClose, onDeleted }: DeleteLeadDialogProps) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!lead) throw new Error('No lead selected');
      return deleteLead(lead.id);
    },
    onSuccess: () => {
      toast({ title: 'Lead deleted' });
      onDeleted();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to delete lead.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Delete Lead</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="rounded-full bg-destructive/10 p-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">
              Are you sure you want to delete {lead.leadNumber}?
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. The lead will be soft-deleted.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
            ) : 'Delete Lead'}
          </Button>
        </div>
      </div>
    </div>
  );
}
