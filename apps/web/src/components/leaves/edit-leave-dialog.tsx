'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { updateLeave, type Leave } from '@/lib/api/leaves';
import { LEAVE_TYPES } from './leave-types';

interface EditLeaveDialogProps {
  leave: Leave | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditLeaveDialog({ leave, open, onClose, onUpdated }: EditLeaveDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('ANNUAL');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (leave) {
      setStartDate(leave.startDate.split('T')[0]);
      setEndDate(leave.endDate.split('T')[0]);
      setType(leave.type);
      setReason(leave.reason ?? '');
    }
  }, [leave]);

  const updateMutation = useMutation({
    mutationFn: () => leave ? updateLeave(leave.id, { startDate, endDate, type, reason: reason || undefined }) : Promise.resolve(null as never),
    onSuccess: () => {
      toast({ title: 'Leave request updated' });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      onUpdated();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update leave', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (new Date(endDate) < new Date(startDate)) {
      toast({ title: 'Invalid dates', description: 'End date must be after start date.', variant: 'destructive' });
      return;
    }
    updateMutation.mutate();
  }

  if (!leave) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Leave Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">{leave.employee.firstName} {leave.employee.lastName}</p>
            <p className="text-xs text-muted-foreground">{leave.employee.employeeCode}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave..." />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
