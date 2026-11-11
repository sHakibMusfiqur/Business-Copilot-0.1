'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  createDeal,
  updateDeal,
  getCompanies,
  getContacts,
  getOrganizationUsers,
  fetchAllPages,
} from '@/lib/api';
import type { DealListItem, PipelineStage } from '@/lib/api';

const dealSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  value: z.coerce
    .number({ invalid_type_error: 'Value must be a number' })
    .min(0, 'Value must be 0 or more'),
  probability: z.coerce
    .number({ invalid_type_error: 'Probability must be a number' })
    .int('Probability must be a whole number')
    .min(0, 'Probability must be between 0 and 100')
    .max(100, 'Probability must be between 0 and 100'),
  expectedCloseDate: z.string().optional(),
  ownerId: z.string(),
  companyId: z.string(),
  contactId: z.string(),
  notes: z.string().max(5000),
});

type DealFormValues = z.infer<typeof dealSchema>;

interface DealDialogProps {
  open: boolean;
  /** When set, the dialog edits this deal instead of creating one. */
  deal?: DealListItem | null;
  /** Pipeline the new deal belongs to (create mode). */
  pipelineId?: string | null;
  /** Stage the new deal starts in (create mode). */
  stage?: PipelineStage | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_VALUES: DealFormValues = {
  title: '',
  value: 0,
  probability: 0,
  expectedCloseDate: '',
  ownerId: '',
  companyId: '',
  contactId: '',
  notes: '',
};

function toFormValues(deal: DealListItem | null | undefined): DealFormValues {
  if (!deal) return EMPTY_VALUES;
  return {
    title: deal.title,
    value: deal.value,
    probability: deal.probability,
    expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '',
    ownerId: deal.ownerId ?? '',
    companyId: deal.companyId ?? '',
    contactId: deal.contact?.id ?? '',
    notes: deal.notes ?? '',
  };
}

function selectClassName(error: boolean) {
  return `flex h-10 w-full rounded-lg border ${
    error ? 'border-destructive' : 'border-input'
  } bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
}

export function DealDialog({ open, deal, pipelineId, stage, onClose, onSaved }: DealDialogProps) {
  const { toast } = useToast();
  const isEdit = deal != null;

  const [values, setValues] = useState<DealFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(toFormValues(deal));
      setErrors({});
    }
  }, [open, deal]);

  // Every page is loaded (bounded) so dropdowns are not silently truncated
  // at the first 100 records.
  const companiesQuery = useQuery({
    queryKey: ['crm', 'companies', 'options'],
    queryFn: ({ signal }) =>
      fetchAllPages((page) => getCompanies({ limit: 100, page, sortBy: 'name', sortOrder: 'asc' }, signal)),
    enabled: open,
  });
  const contactsQuery = useQuery({
    queryKey: ['crm', 'contacts', 'options'],
    queryFn: ({ signal }) =>
      fetchAllPages((page) => getContacts({ limit: 100, page, sortBy: 'lastName', sortOrder: 'asc' }, signal)),
    enabled: open,
  });
  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: open,
  });

  const companies = companiesQuery.data?.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];
  const users = usersQuery.data ?? [];
  const companiesTotal = companiesQuery.data?.total;
  const contactsTotal = contactsQuery.data?.total;

  const saveMutation = useMutation({
    mutationFn: () => {
      const parsed = dealSchema.parse(values);
      if (isEdit && deal) {
        return updateDeal(deal.id, {
          title: parsed.title,
          value: parsed.value,
          probability: parsed.probability,
          expectedCloseDate: parsed.expectedCloseDate || null,
          ownerId: parsed.ownerId || null,
          companyId: parsed.companyId || null,
          contactId: parsed.contactId || null,
          notes: parsed.notes,
        });
      }
      return createDeal({
        title: parsed.title,
        value: parsed.value,
        probability: parsed.probability,
        pipelineId: pipelineId ?? undefined,
        stageId: stage?.id,
        expectedCloseDate: parsed.expectedCloseDate || undefined,
        ownerId: parsed.ownerId || undefined,
        companyId: parsed.companyId || undefined,
        contactId: parsed.contactId || undefined,
        notes: parsed.notes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Deal updated' : 'Deal created' });
      onSaved();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to save deal.',
        variant: 'destructive',
      });
    },
  });

  // Block backdrop/X/Cancel while a save is in flight; the success path still
  // closes via saveMutation.onSuccess.
  const requestClose = () => {
    if (saveMutation.isPending) return;
    onClose();
  };

  function setField<K extends keyof DealFormValues>(key: K, value: DealFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const result = dealSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    saveMutation.mutate();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit deal' : 'Create deal'}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={requestClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Deal' : 'Create Deal'}</h2>
          <button
            onClick={requestClose}
            disabled={saveMutation.isPending}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="deal-title">Title *</Label>
            <Input
              id="deal-title"
              value={values.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Big renewal contract"
              aria-invalid={errors.title ? true : undefined}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label htmlFor="deal-value">Value *</Label>
            <Input
              id="deal-value"
              type="number"
              min={0}
              step="0.01"
              value={values.value}
              onChange={(e) => setField('value', Number(e.target.value))}
            />
            {errors.value && <p className="text-xs text-destructive mt-1">{errors.value}</p>}
          </div>

          <div>
            <Label htmlFor="deal-probability">Probability (%)</Label>
            <Input
              id="deal-probability"
              type="number"
              min={0}
              max={100}
              value={values.probability}
              onChange={(e) => setField('probability', Number(e.target.value))}
            />
            {errors.probability && <p className="text-xs text-destructive mt-1">{errors.probability}</p>}
          </div>

          <div>
            <Label htmlFor="deal-close-date">Expected Close Date</Label>
            <Input
              id="deal-close-date"
              type="date"
              value={values.expectedCloseDate}
              onChange={(e) => setField('expectedCloseDate', e.target.value)}
            />
            {errors.expectedCloseDate && (
              <p className="text-xs text-destructive mt-1">{errors.expectedCloseDate}</p>
            )}
          </div>

          <div>
            <Label htmlFor="deal-owner">Owner</Label>
            <select
              id="deal-owner"
              value={values.ownerId}
              onChange={(e) => setField('ownerId', e.target.value)}
              className={selectClassName(Boolean(errors.ownerId))}
              disabled={usersQuery.isLoading}
            >
              <option value="">{usersQuery.isLoading ? 'Loading users...' : 'Unassigned'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {errors.ownerId && <p className="text-xs text-destructive mt-1">{errors.ownerId}</p>}
            {usersQuery.isError && (
              <p className="text-xs text-destructive mt-1">
                Failed to load users.{' '}
                <button type="button" className="underline" onClick={() => usersQuery.refetch()}>
                  Retry
                </button>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="deal-company">Company</Label>
            <select
              id="deal-company"
              value={values.companyId}
              onChange={(e) => setField('companyId', e.target.value)}
              className={selectClassName(Boolean(errors.companyId))}
              disabled={companiesQuery.isLoading}
            >
              <option value="">{companiesQuery.isLoading ? 'Loading companies...' : 'None'}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.companyId && <p className="text-xs text-destructive mt-1">{errors.companyId}</p>}
            {companiesQuery.isError && (
              <p className="text-xs text-destructive mt-1">
                Failed to load companies.{' '}
                <button type="button" className="underline" onClick={() => companiesQuery.refetch()}>
                  Retry
                </button>
              </p>
            )}
            {companiesTotal != null && companies.length < companiesTotal && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing first {companies.length} of {companiesTotal}.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="deal-contact">Contact</Label>
            <select
              id="deal-contact"
              value={values.contactId}
              onChange={(e) => setField('contactId', e.target.value)}
              className={selectClassName(Boolean(errors.contactId))}
              disabled={contactsQuery.isLoading}
            >
              <option value="">{contactsQuery.isLoading ? 'Loading contacts...' : 'None'}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
            {errors.contactId && <p className="text-xs text-destructive mt-1">{errors.contactId}</p>}
            {contactsQuery.isError && (
              <p className="text-xs text-destructive mt-1">
                Failed to load contacts.{' '}
                <button type="button" className="underline" onClick={() => contactsQuery.refetch()}>
                  Retry
                </button>
              </p>
            )}
            {contactsTotal != null && contacts.length < contactsTotal && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing first {contacts.length} of {contactsTotal}.
              </p>
            )}
          </div>

          {!isEdit && stage && (
            <div>
              <Label>Starting Stage</Label>
              <p className="text-sm text-muted-foreground mt-1.5">{stage.name}</p>
            </div>
          )}

          <div className="col-span-2">
            <Label htmlFor="deal-notes">Notes</Label>
            <textarea
              id="deal-notes"
              value={values.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Deal notes..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes}</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={requestClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Create Deal'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
