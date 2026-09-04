'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { createLeave, type CreateLeaveData } from '@/lib/api/leaves';
import { getEmployees, type Employee } from '@/lib/api/employees';
import { LEAVE_TYPES } from './leave-types';
import { useQuery } from '@tanstack/react-query';

interface CreateLeaveDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateLeaveDialog({ open, onClose, onCreated }: CreateLeaveDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('ANNUAL');
  const [reason, setReason] = useState('');

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => getEmployees(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLeaveData) => createLeave(data),
    onSuccess: () => {
      toast({ title: 'Leave request created', description: 'The leave request has been submitted.' });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      resetForm();
      onCreated();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create leave request', description: error.message, variant: 'destructive' });
    },
  });

  function resetForm() {
    setEmployeeId('');
    setStartDate('');
    setEndDate('');
    setType('ANNUAL');
    setReason('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !startDate || !endDate) return;
    createMutation.mutate({ employeeId, startDate, endDate, type, reason: reason || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Leave Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Employee</Label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              required
            >
              <option value="">Select employee</option>
              {(employeesQuery.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
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
            <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
