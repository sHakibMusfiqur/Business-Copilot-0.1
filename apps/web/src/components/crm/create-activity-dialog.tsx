'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createActivity } from '@/lib/api';
import type { ActivityType } from './crm-types';

const createSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
});

interface CreateActivityDialogProps {
  leadId: string;
  leadLabel: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const ACTIVITY_TYPE_OPTIONS: ActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE'];

export function CreateActivityDialog({ leadId, leadLabel, open, onClose, onCreated }: CreateActivityDialogProps) {
  const { toast } = useToast();

  const [type, setType] = useState<ActivityType>('TASK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: () => createActivity(leadId, {
      type,
      title,
      description: description || undefined,
      dueDate: dueDate || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Activity created' });
      onCreated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create activity.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setType('TASK');
    setTitle('');
    setDescription('');
    setDueDate('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const result = createSchema.safeParse({ type, title, description: description || undefined });
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
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Add Activity</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Add activity for <span className="font-medium text-foreground">{leadLabel}</span>
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="activity-type">Type *</Label>
            <div className="flex gap-2 mt-1">
              {ACTIVITY_TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all ${
                    type === t
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-input hover:bg-accent'
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="activity-title">Title *</Label>
            <Input id="activity-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call with prospect, Follow-up email..." />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label htmlFor="activity-description">Description</Label>
            <textarea
              id="activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Activity details..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <Label htmlFor="activity-dueDate">Due Date</Label>
            <Input id="activity-dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
            ) : 'Create Activity'}
          </Button>
        </div>
      </div>
    </div>
  );
}
