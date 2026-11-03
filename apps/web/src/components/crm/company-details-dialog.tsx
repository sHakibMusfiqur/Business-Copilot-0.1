'use client';

import { X, Building2, Loader2, Users2, Trophy, ClipboardList } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { formatDate, formatCurrency } from '@/lib/utils';
import { getCompanyById } from '@/lib/api';
import type { CompanyDetail, CompanyListItem } from '@/lib/api';

interface CompanyDetailsDialogProps {
  /** Id of the company to load full details for. */
  companyId: string | null;
  /** Fallback row data shown while details load or on error. */
  company?: CompanyListItem | null;
  open: boolean;
  onClose: () => void;
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm">{value || '\u2014'}</p>
    </div>
  );
}

export function CompanyDetailsDialog({ companyId, company, open, onClose }: CompanyDetailsDialogProps) {
  const detailQuery = useQuery({
    queryKey: ['crm', 'companies', companyId],
    queryFn: ({ signal }) => getCompanyById(companyId as string, signal),
    enabled: open && companyId != null,
  });

  if (!open) return null;

  const detail: CompanyDetail | undefined = detailQuery.data;
  const header = detail ?? company ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Company details">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Company Details</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {detailQuery.isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            <span className="text-sm">Loading company...</span>
          </div>
        )}

        {detailQuery.isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load company details: {detailQuery.error.message}
          </div>
        )}

        {!detailQuery.isLoading && !detailQuery.isError && header && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-full bg-muted p-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold">{header.name}</p>
                <p className="text-xs text-muted-foreground">{header.domain ?? header.website ?? '\u2014'}</p>
              </div>
            </div>

            {detail && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Open Deals</p>
                  <p className="text-lg font-semibold">{detail.stats.openDealCount}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(detail.stats.openPipelineValue)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Won Deals</p>
                  <p className="text-lg font-semibold">{detail.stats.wonDealCount}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(detail.stats.wonValue)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Contacts</p>
                  <p className="text-lg font-semibold">{detail.contacts.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="text-sm font-medium truncate">{detail.owner?.name ?? '\u2014'}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <InfoField label="Industry" value={header.industry} />
              <InfoField label="Email" value={header.email} />
              <InfoField label="Phone" value={header.phone} />
              <InfoField label="Website" value={header.website} />
              <InfoField label="Address" value={header.address} />
              <InfoField label="City / State" value={[header.city, header.state].filter(Boolean).join(', ') || null} />
              <InfoField label="ZIP / Country" value={[header.zipCode, header.country].filter(Boolean).join(', ') || null} />
              <InfoField label="Created" value={formatDate(header.createdAt)} />
              {header.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{header.notes}</p>
                </div>
              )}
            </div>

            {detail && (
              <div className="space-y-5">
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Users2 className="h-4 w-4 text-muted-foreground" /> Contacts
                  </h3>
                  {detail.contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contacts linked to this company.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {detail.contacts.map((contact) => (
                        <li key={contact.id} className="flex items-center justify-between p-3 text-sm">
                          <span>
                            {contact.firstName} {contact.lastName}
                            {contact.jobTitle && <span className="text-muted-foreground"> · {contact.jobTitle}</span>}
                          </span>
                          <span className="text-xs text-muted-foreground">{contact.email ?? contact.phone ?? ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" /> Deals
                  </h3>
                  {detail.deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deals linked to this company.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {detail.deals.map((deal) => (
                        <li key={deal.id} className="flex items-center justify-between p-3 text-sm">
                          <span className="truncate">{deal.title}</span>
                          <span className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground">{deal.stage?.name ?? 'No stage'}</span>
                            <span className="font-medium">{formatCurrency(deal.value)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="flex items-center gap-2 text-sm font-medium mb-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" /> Recent Activities
                  </h3>
                  {detail.activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activities linked to this company.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {detail.activities.map((activity) => (
                        <li key={activity.id} className="flex items-center justify-between p-3 text-sm">
                          <span className={activity.completed ? 'line-through text-muted-foreground' : ''}>
                            {activity.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {activity.dueDate ? formatDate(activity.dueDate) : activity.type}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
