'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createCompany, updateCompany, getOrganizationUsers } from '@/lib/api';
import type { CompanyListItem } from '@/lib/api';

const companySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or fewer'),
  domain: z.string().max(200),
  industry: z.string().max(120),
  phone: z.string().max(40),
  email: z.string().email('Invalid email').or(z.literal('')),
  website: z.string().max(254),
  address: z.string().max(300),
  city: z.string().max(120),
  state: z.string().max(120),
  zipCode: z.string().max(20),
  country: z.string().max(120),
  ownerId: z.string(),
  notes: z.string().max(5000),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyDialogProps {
  open: boolean;
  /** When set, the dialog edits this company instead of creating one. */
  company?: CompanyListItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_VALUES: CompanyFormValues = {
  name: '',
  domain: '',
  industry: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  ownerId: '',
  notes: '',
};

function toFormValues(company: CompanyListItem | null | undefined): CompanyFormValues {
  if (!company) return EMPTY_VALUES;
  return {
    name: company.name,
    domain: company.domain ?? '',
    industry: company.industry ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    website: company.website ?? '',
    address: company.address ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    zipCode: company.zipCode ?? '',
    country: company.country ?? '',
    ownerId: company.ownerId ?? '',
    notes: company.notes ?? '',
  };
}

export function CompanyDialog({ open, company, onClose, onSaved }: CompanyDialogProps) {
  const { toast } = useToast();
  const isEdit = company != null;

  const [values, setValues] = useState<CompanyFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(toFormValues(company));
      setErrors({});
    }
  }, [open, company]);

  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => getOrganizationUsers(),
    enabled: open,
  });
  const users: Array<{ id: string; name: string }> = usersQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: values.name.trim(),
        domain: values.domain.trim() || undefined,
        industry: values.industry.trim() || undefined,
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        website: values.website.trim() || undefined,
        address: values.address.trim() || undefined,
        city: values.city.trim() || undefined,
        state: values.state.trim() || undefined,
        zipCode: values.zipCode.trim() || undefined,
        country: values.country.trim() || undefined,
        ownerId: values.ownerId || undefined,
        notes: values.notes.trim() || undefined,
      };
      return isEdit && company ? updateCompany(company.id, payload) : createCompany(payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Company updated' : 'Company created' });
      onSaved();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to save company.',
        variant: 'destructive',
      });
    },
  });

  function setField<K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const result = companySchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    saveMutation.mutate();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit company' : 'Create company'}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Company' : 'Create Company'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-name">Name *</Label>
            <Input id="company-name" value={values.name} onChange={(e) => setField('name', e.target.value)} placeholder="Acme Corp" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-domain">Domain</Label>
            <Input id="company-domain" value={values.domain} onChange={(e) => setField('domain', e.target.value)} placeholder="acme.com" />
            {errors.domain && <p className="text-xs text-destructive mt-1">{errors.domain}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-industry">Industry</Label>
            <Input id="company-industry" value={values.industry} onChange={(e) => setField('industry', e.target.value)} placeholder="Software" />
            {errors.industry && <p className="text-xs text-destructive mt-1">{errors.industry}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-owner">Owner</Label>
            <select
              id="company-owner"
              value={values.ownerId}
              onChange={(e) => setField('ownerId', e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {errors.ownerId && <p className="text-xs text-destructive mt-1">{errors.ownerId}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-email">Email</Label>
            <Input id="company-email" type="email" value={values.email} onChange={(e) => setField('email', e.target.value)} placeholder="hello@acme.com" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-phone">Phone</Label>
            <Input id="company-phone" value={values.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+1 (555) 000-0000" />
            {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
          </div>
          <div className="col-span-2">
            <Label htmlFor="company-website">Website</Label>
            <Input id="company-website" value={values.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://acme.com" />
            {errors.website && <p className="text-xs text-destructive mt-1">{errors.website}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-address">Address</Label>
            <Input id="company-address" value={values.address} onChange={(e) => setField('address', e.target.value)} placeholder="123 Main St" />
            {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-city">City</Label>
            <Input id="company-city" value={values.city} onChange={(e) => setField('city', e.target.value)} />
            {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-state">State</Label>
            <Input id="company-state" value={values.state} onChange={(e) => setField('state', e.target.value)} />
            {errors.state && <p className="text-xs text-destructive mt-1">{errors.state}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-zip">ZIP Code</Label>
            <Input id="company-zip" value={values.zipCode} onChange={(e) => setField('zipCode', e.target.value)} />
            {errors.zipCode && <p className="text-xs text-destructive mt-1">{errors.zipCode}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="company-country">Country</Label>
            <Input id="company-country" value={values.country} onChange={(e) => setField('country', e.target.value)} />
            {errors.country && <p className="text-xs text-destructive mt-1">{errors.country}</p>}
          </div>
          <div className="col-span-2">
            <Label htmlFor="company-notes">Notes</Label>
            <textarea
              id="company-notes"
              value={values.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Company notes..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes}</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : isEdit ? 'Save Changes' : 'Create Company'}
          </Button>
        </div>
      </div>
    </div>
  );
}
