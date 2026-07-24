'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createLead, getOrganizationUsers } from '@/lib/api';
import type { LeadStatus } from './crm-types';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  estimatedValue: z.number().min(0, 'Value must be 0 or more').optional(),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
});

interface CreateLeadDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const LEAD_STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

export function CreateLeadDialog({ open, onClose, onCreated }: CreateLeadDialogProps) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<LeadStatus>('NEW');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => getOrganizationUsers(),
    enabled: open,
  });

  const users: Array<{ id: string; name: string }> = usersQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createLead({
      name,
      company: company || undefined,
      email: email || undefined,
      phone: phone || undefined,
      source: source || undefined,
      status,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      assignedToId: assignedToId || undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Lead created' });
      onCreated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create lead.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setSource('');
    setStatus('NEW');
    setEstimatedValue('');
    setAssignedToId('');
    setNotes('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const result = createSchema.safeParse({
      name,
      company: company || undefined,
      email: email || undefined,
      phone: phone || undefined,
      source: source || undefined,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      assignedToId: assignedToId || undefined,
      notes: notes || undefined,
    });
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
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create Lead</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company">Company</Label>
            <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@acme.com" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="source">Source</Label>
            <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Website, Referral, ..." />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {LEAD_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
            <Input id="estimatedValue" type="number" min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
            {errors.estimatedValue && <p className="text-xs text-destructive mt-1">{errors.estimatedValue}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="assignedTo">Assign To</Label>
            <select
              id="assignedTo"
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
          <div className="col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lead notes..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
            ) : 'Create Lead'}
          </Button>
        </div>
      </div>
    </div>
  );
}
