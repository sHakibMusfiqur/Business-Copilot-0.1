'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { updateLeadStatus } from '@/lib/api';
import type { LeadListItem, LeadStatus } from './crm-types';

const LEAD_STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

interface ChangeStatusDialogProps {
  lead: LeadListItem | null;
  open: boolean;
  onClose: () => void;
  onStatusChanged: () => void;
}

export function ChangeStatusDialog({ lead, open, onClose, onStatusChanged }: ChangeStatusDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<LeadStatus>('NEW');

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
    }
  }, [lead]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!lead) throw new Error('No lead selected');
      if (status === lead.status) throw new Error('Status unchanged');
      return updateLeadStatus(lead.id, status);
    },
    onSuccess: () => {
      toast({ title: 'Lead status updated' });
      onStatusChanged();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update status.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Change Status</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Change status for <span className="font-medium text-foreground">{lead.leadNumber}</span>
        </p>

        <div className="space-y-3">
          <Label htmlFor="change-status">Status</Label>
          <div className="grid grid-cols-2 gap-2">
            {LEAD_STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                disabled={s === lead.status}
                className={`flex items-center justify-center rounded-lg border px-3 py-2 text-sm transition-all ${
                  status === s
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-input hover:bg-accent'
                } ${s === lead.status ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || status === lead.status}
          >
            {updateMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
            ) : 'Update Status'}
          </Button>
        </div>
      </div>
    </div>
  );
}
