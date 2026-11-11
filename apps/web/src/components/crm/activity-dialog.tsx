'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2, Link2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  createCrmActivity,
  updateCrmActivity,
  getLeads,
  getContacts,
  getDeals,
  getCompanies,
  getOrganizationUsers,
  fetchAllPages,
} from '@/lib/api';
import type { CrmActivity, ActivityPayload } from '@/lib/api';

type LinkType = 'lead' | 'contact' | 'deal' | 'company';

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE'] as const;

/** Fields editable in both create and edit mode. */
const activityBaseSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(5000),
  dueDate: z.string().optional(),
  completed: z.boolean(),
});

/**
 * Create mode additionally requires the link and assignee. The backend treats
 * these as create-only (UpdateActivityDto has no link/assignee fields), so edit
 * mode must not validate them — otherwise edits can never save.
 */
const activitySchema = activityBaseSchema.extend({
  linkType: z.enum(['lead', 'contact', 'deal', 'company']),
  linkId: z.string().min(1, 'Select what this activity is linked to'),
  assignedToId: z.string(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

interface ActivityDialogProps {
  open: boolean;
  /** When set, the dialog edits this activity instead of creating one. */
  activity?: CrmActivity | null;
  /** Prefill the link when creating from a lead detail page. */
  defaultLink?: { type: LinkType; id: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

interface LeadOption {
  id: string;
  leadNumber: string;
  name: string;
}

function selectClassName(error: boolean) {
  return `flex h-10 w-full rounded-lg border ${
    error ? 'border-destructive' : 'border-input'
  } bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;
}

function describeLink(activity: CrmActivity): string {
  if (activity.lead) return `Lead · ${activity.lead.leadNumber} · ${activity.lead.name}`;
  if (activity.deal) return `Deal · ${activity.deal.title}`;
  if (activity.company) return `Company · ${activity.company.name}`;
  if (activity.contact) return `Contact · ${activity.contact.firstName} ${activity.contact.lastName}`;
  return 'Not linked';
}

export function ActivityDialog({ open, activity, defaultLink, onClose, onSaved }: ActivityDialogProps) {
  const { toast } = useToast();
  const isEdit = activity != null;

  const [values, setValues] = useState<ActivityFormValues>({
    type: 'TASK',
    title: '',
    description: '',
    dueDate: '',
    completed: false,
    linkType: defaultLink?.type ?? 'company',
    linkId: defaultLink?.id ?? '',
    assignedToId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (activity) {
      const linkType: LinkType = activity.lead
        ? 'lead'
        : activity.deal
          ? 'deal'
          : activity.company
            ? 'company'
            : 'contact';
      setValues({
        type: activity.type as (typeof ACTIVITY_TYPES)[number],
        title: activity.title,
        description: activity.description ?? '',
        dueDate: activity.dueDate ? activity.dueDate.slice(0, 10) : '',
        completed: activity.completed,
        linkType,
        linkId: '',
        assignedToId: activity.assignedTo?.id ?? '',
      });
    } else {
      setValues({
        type: 'TASK',
        title: '',
        description: '',
        dueDate: '',
        completed: false,
        linkType: defaultLink?.type ?? 'company',
        linkId: defaultLink?.id ?? '',
        assignedToId: '',
      });
    }
  }, [open, activity, defaultLink]);

  const linkType = values.linkType;

  // Only the selector for the chosen link type is fetched; every page is
  // loaded (bounded) so options are not silently truncated at 100.
  const leadOptionsQuery = useQuery({
    queryKey: ['crm', 'leads', 'options'],
    queryFn: ({ signal }) => fetchAllPages<LeadOption>((page) => getLeads({ limit: 100, page }, signal)),
    enabled: open && !isEdit && linkType === 'lead',
  });
  const contactOptionsQuery = useQuery({
    queryKey: ['crm', 'contacts', 'options'],
    queryFn: ({ signal }) =>
      fetchAllPages((page) => getContacts({ limit: 100, page, sortBy: 'lastName', sortOrder: 'asc' }, signal)),
    enabled: open && !isEdit && linkType === 'contact',
  });
  const dealOptionsQuery = useQuery({
    queryKey: ['crm', 'deals', 'options'],
    queryFn: ({ signal }) => fetchAllPages((page) => getDeals({ limit: 100, page }, signal)),
    enabled: open && !isEdit && linkType === 'deal',
  });
  const companyOptionsQuery = useQuery({
    queryKey: ['crm', 'companies', 'options'],
    queryFn: ({ signal }) =>
      fetchAllPages((page) => getCompanies({ limit: 100, page, sortBy: 'name', sortOrder: 'asc' }, signal)),
    enabled: open && !isEdit && linkType === 'company',
  });
  const usersQuery = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: ({ signal }) => getOrganizationUsers(signal),
    enabled: open && !isEdit,
  });

  // Only one entity selector is enabled at a time, so combined flags are safe.
  const optionsLoading =
    leadOptionsQuery.isLoading ||
    contactOptionsQuery.isLoading ||
    dealOptionsQuery.isLoading ||
    companyOptionsQuery.isLoading;
  const optionsError =
    leadOptionsQuery.isError ||
    contactOptionsQuery.isError ||
    dealOptionsQuery.isError ||
    companyOptionsQuery.isError;
  const activeOptions =
    values.linkType === 'lead'
      ? leadOptionsQuery.data
      : values.linkType === 'contact'
        ? contactOptionsQuery.data
        : values.linkType === 'deal'
          ? dealOptionsQuery.data
          : companyOptionsQuery.data;

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Edit mode validates/sends only the base fields; link + assignee are create-only.
      if (isEdit && activity) {
        const parsed = activityBaseSchema.parse(values);
        const payload: Partial<ActivityPayload> = {
          type: parsed.type,
          title: parsed.title,
          description: parsed.description.trim() || null,
          dueDate: parsed.dueDate ? new Date(parsed.dueDate).toISOString() : null,
          completed: parsed.completed,
        };
        return updateCrmActivity(activity.id, payload);
      }

      const parsed = activitySchema.parse(values);
      const payload: ActivityPayload = {
        type: parsed.type,
        title: parsed.title,
        description: parsed.description.trim() || undefined,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate).toISOString() : undefined,
        assignedToId: parsed.assignedToId || undefined,
        // Exactly one primary entity reference, as required by the backend
        leadId: parsed.linkType === 'lead' ? parsed.linkId : undefined,
        contactId: parsed.linkType === 'contact' ? parsed.linkId : undefined,
        dealId: parsed.linkType === 'deal' ? parsed.linkId : undefined,
        companyId: parsed.linkType === 'company' ? parsed.linkId : undefined,
      };
      return createCrmActivity(payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Activity updated' : 'Activity created' });
      onSaved();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to save activity.',
        variant: 'destructive',
      });
    },
  });

  // Close (backdrop/X/Cancel) is blocked while a save is in flight so the
  // dialog cannot vanish under an unfinished write. The success path still
  // closes via saveMutation.onSuccess.
  const requestClose = () => {
    if (saveMutation.isPending) return;
    onClose();
  };

  function setField<K extends keyof ActivityFormValues>(key: K, value: ActivityFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    // Edit mode must not require link/assignee (they are create-only).
    const result = isEdit ? activityBaseSchema.safeParse(values) : activitySchema.safeParse(values);
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

  const users = usersQuery.data ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit activity' : 'Create activity'}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={requestClose} />
      <div className="relative z-50 w-full max-w-xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Activity' : 'Create Activity'}</h2>
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
            <Label htmlFor="activity-type">Type *</Label>
            <select
              id="activity-type"
              value={values.type}
              onChange={(e) => setField('type', e.target.value as ActivityFormValues['type'])}
              className={selectClassName(Boolean(errors.type))}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            {errors.type && <p className="text-xs text-destructive mt-1">{errors.type}</p>}
          </div>

          <div>
            <Label htmlFor="activity-due-date">Due Date</Label>
            <Input
              id="activity-due-date"
              type="date"
              value={values.dueDate}
              onChange={(e) => setField('dueDate', e.target.value)}
            />
            {errors.dueDate && <p className="text-xs text-destructive mt-1">{errors.dueDate}</p>}
          </div>

          <div className="col-span-2">
            <Label htmlFor="activity-title">Title *</Label>
            <Input
              id="activity-title"
              value={values.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Follow-up call about renewal"
              aria-invalid={errors.title ? true : undefined}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div className="col-span-2">
            <Label htmlFor="activity-description">Description</Label>
            <textarea
              id="activity-description"
              value={values.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Notes about this activity..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
          </div>

          {isEdit ? (
            <div className="col-span-2">
              <Label>Linked to</Label>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />
                {describeLink(activity as CrmActivity)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The link and assignee are set when the activity is created.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="activity-link-type">Linked to *</Label>
                <select
                  id="activity-link-type"
                  value={values.linkType}
                  onChange={(e) => {
                    setField('linkType', e.target.value as LinkType);
                    setField('linkId', '');
                  }}
                  className={selectClassName(Boolean(errors.linkType))}
                >
                  <option value="lead">Lead</option>
                  <option value="contact">Contact</option>
                  <option value="deal">Deal</option>
                  <option value="company">Company</option>
                </select>
                {errors.linkType && <p className="text-xs text-destructive mt-1">{errors.linkType}</p>}
              </div>

              <div>
                <Label htmlFor="activity-link-id">
                  {values.linkType === 'lead'
                    ? 'Lead'
                    : values.linkType === 'contact'
                      ? 'Contact'
                      : values.linkType === 'deal'
                        ? 'Deal'
                        : 'Company'}{' '}
                  *
                </Label>
                <select
                  id="activity-link-id"
                  value={values.linkId}
                  onChange={(e) => setField('linkId', e.target.value)}
                  className={selectClassName(Boolean(errors.linkId))}
                  disabled={optionsLoading}
                >
                  <option value="">{optionsLoading ? 'Loading options...' : 'Select...'}</option>
                  {values.linkType === 'lead' &&
                    (leadOptionsQuery.data?.data ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.leadNumber} · {o.name}
                      </option>
                    ))}
                  {values.linkType === 'contact' &&
                    (contactOptionsQuery.data?.data ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.firstName} {o.lastName}
                      </option>
                    ))}
                  {values.linkType === 'deal' &&
                    (dealOptionsQuery.data?.data ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  {values.linkType === 'company' &&
                    (companyOptionsQuery.data?.data ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                {errors.linkId && <p className="text-xs text-destructive mt-1">{errors.linkId}</p>}
                {optionsError && (
                  <p className="text-xs text-destructive mt-1">
                    Failed to load options.{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        if (values.linkType === 'lead') leadOptionsQuery.refetch();
                        else if (values.linkType === 'contact') contactOptionsQuery.refetch();
                        else if (values.linkType === 'deal') dealOptionsQuery.refetch();
                        else companyOptionsQuery.refetch();
                      }}
                    >
                      Retry
                    </button>
                  </p>
                )}
                {activeOptions && activeOptions.total > activeOptions.data.length && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing first {activeOptions.data.length} of {activeOptions.total} — search on the list
                    pages to find more.
                  </p>
                )}
              </div>

              <div className="col-span-2">
                <Label htmlFor="activity-assignee">Assignee</Label>
                <select
                  id="activity-assignee"
                  value={values.assignedToId}
                  onChange={(e) => setField('assignedToId', e.target.value)}
                  className={selectClassName(Boolean(errors.assignedToId))}
                  disabled={usersQuery.isLoading}
                >
                  <option value="">
                    {usersQuery.isLoading ? 'Loading users...' : 'Anyone (unassigned)'}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                {errors.assignedToId && <p className="text-xs text-destructive mt-1">{errors.assignedToId}</p>}
                {usersQuery.isError && (
                  <p className="text-xs text-destructive mt-1">
                    Failed to load users.{' '}
                    <button type="button" className="underline" onClick={() => usersQuery.refetch()}>
                      Retry
                    </button>
                  </p>
                )}
              </div>
            </>
          )}

          {isEdit && (
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="activity-completed"
                type="checkbox"
                checked={values.completed}
                onChange={(e) => setField('completed', e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="activity-completed" className="mb-0">
                Completed
              </Label>
            </div>
          )}
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
              'Create Activity'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
