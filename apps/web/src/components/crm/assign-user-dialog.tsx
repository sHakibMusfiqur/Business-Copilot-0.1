'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { assignLead, getOrganizationUsers } from '@/lib/api';
import type { LeadListItem } from './crm-types';

interface AssignUserDialogProps {
  lead: LeadListItem | null;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignUserDialog({ lead, open, onClose, onAssigned }: AssignUserDialogProps) {
  const { toast } = useToast();
  const [assignedToId, setAssignedToId] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => getOrganizationUsers(),
    enabled: open,
  });

  const users: Array<{ id: string; name: string }> = usersQuery.data ?? [];

  useEffect(() => {
    if (lead) {
      setAssignedToId(lead.assignedToId ?? '');
    }
  }, [lead]);

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!lead) throw new Error('No lead selected');
      return assignLead(lead.id, assignedToId || null);
    },
    onSuccess: () => {
      toast({ title: 'Lead assigned' });
      onAssigned();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to assign lead.',
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
          <h2 className="text-lg font-semibold">Assign Lead</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Assign <span className="font-medium text-foreground">{lead.leadNumber}</span> to a team member
        </p>

        <div className="space-y-3">
          <Label htmlFor="assign-user">Team Member</Label>
          <select
            id="assign-user"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
            {assignMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning...</>
            ) : 'Assign'}
          </Button>
        </div>
      </div>
    </div>
  );
}
