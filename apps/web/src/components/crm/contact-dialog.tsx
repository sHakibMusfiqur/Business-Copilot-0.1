'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createContact, updateContact, getCompanies, getOrganizationUsers, fetchAllPages } from '@/lib/api';
import type { ContactListItem, ContactStatus } from '@/lib/api';

const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(120),
  lastName: z.string().min(1, 'Last name is required').max(120),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string().max(40),
  jobTitle: z.string().max(120),
  company: z.string().max(200),
  companyId: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
  source: z.string().max(120),
  ownerId: z.string(),
  notes: z.string().max(5000),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactDialogProps {
  open: boolean;
  /** When set, the dialog edits this contact instead of creating one. */
  contact?: ContactListItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_VALUES: ContactFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  company: '',
  companyId: '',
  status: 'ACTIVE',
  source: '',
  ownerId: '',
  notes: '',
};

function toFormValues(contact: ContactListItem | null | undefined): ContactFormValues {
  if (!contact) return EMPTY_VALUES;
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    jobTitle: contact.jobTitle ?? '',
    company: contact.company ?? '',
    companyId: contact.companyId ?? '',
    status: contact.status,
    source: contact.source ?? '',
    ownerId: contact.ownerId ?? '',
    notes: contact.notes ?? '',
  };
}

function selectClassName(error: boolean) {
  return `flex h-10 w-full rounded-lg border ${
    error ? 'border-destructive' : 'border-input'
  } bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
}

export function ContactDialog({ open, contact, onClose, onSaved }: ContactDialogProps) {
  const { toast } = useToast();
  const isEdit = contact != null;

  const [values, setValues] = useState<ContactFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(toFormValues(contact));
      setErrors({});
    }
  }, [open, contact]);

  // Every page is loaded (bounded) so dropdowns are not silently truncated
  // at the first 100 records.
  const companiesQuery = useQuery({
    queryKey: ['crm', 'companies', 'options'],
    queryFn: ({ signal }) =>
      fetchAllPages((page) => getCompanies({ limit: 100, page, sortBy: 'name', sortOrder: 'asc' }, signal)),
    enabled: open,
  });
  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: open,
  });

  const companies = companiesQuery.data?.data ?? [];
  const users = usersQuery.data ?? [];
  const companiesTotal = companiesQuery.data?.total;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        jobTitle: values.jobTitle.trim() || null,
        company: values.company.trim() || null,
        companyId: values.companyId || null,
        status: values.status as ContactStatus,
        source: values.source.trim() || null,
        ownerId: values.ownerId || null,
        notes: values.notes.trim() || null,
      };
      return isEdit && contact ? updateContact(contact.id, payload) : createContact(payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Contact updated' : 'Contact created' });
      onSaved();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to save contact.',
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

  function setField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const result = contactSchema.safeParse(values);
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
      aria-label={isEdit ? 'Edit contact' : 'Create contact'}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={requestClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Contact' : 'Create Contact'}</h2>
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
          <div>
            <Label htmlFor="contact-first-name">First Name *</Label>
            <Input
              id="contact-first-name"
              value={values.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              aria-invalid={errors.firstName ? true : undefined}
            />
            {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <Label htmlFor="contact-last-name">Last Name *</Label>
            <Input
              id="contact-last-name"
              value={values.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              aria-invalid={errors.lastName ? true : undefined}
            />
            {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
          </div>
          <div>
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="contact-phone">Phone</Label>
            <Input id="contact-phone" value={values.phone} onChange={(e) => setField('phone', e.target.value)} />
            {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
          </div>
          <div>
            <Label htmlFor="contact-job-title">Job Title</Label>
            <Input
              id="contact-job-title"
              value={values.jobTitle}
              onChange={(e) => setField('jobTitle', e.target.value)}
              placeholder="e.g. Procurement Manager"
            />
            {errors.jobTitle && <p className="text-xs text-destructive mt-1">{errors.jobTitle}</p>}
          </div>
          <div>
            <Label htmlFor="contact-company-record">Company Record</Label>
            <select
              id="contact-company-record"
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
            <Label htmlFor="contact-company-name">Company Name (text)</Label>
            <Input
              id="contact-company-name"
              value={values.company}
              onChange={(e) => setField('company', e.target.value)}
              placeholder="Free-text company name"
            />
            {errors.company && <p className="text-xs text-destructive mt-1">{errors.company}</p>}
          </div>
          <div>
            <Label htmlFor="contact-status">Status</Label>
            <select
              id="contact-status"
              value={values.status}
              onChange={(e) => setField('status', e.target.value as ContactStatus)}
              className={selectClassName(Boolean(errors.status))}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            {errors.status && <p className="text-xs text-destructive mt-1">{errors.status}</p>}
          </div>
          <div>
            <Label htmlFor="contact-source">Source</Label>
            <Input
              id="contact-source"
              value={values.source}
              onChange={(e) => setField('source', e.target.value)}
              placeholder="e.g. Referral"
            />
            {errors.source && <p className="text-xs text-destructive mt-1">{errors.source}</p>}
          </div>
          <div>
            <Label htmlFor="contact-owner">Owner</Label>
            <select
              id="contact-owner"
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
          <div className="col-span-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <textarea
              id="contact-notes"
              value={values.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Contact notes..."
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
              'Create Contact'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
