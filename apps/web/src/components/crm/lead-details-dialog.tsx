'use client';

import { X } from 'lucide-react';

import { formatDate, formatCurrency } from '@/lib/utils';
import type { Lead, LeadListItem } from './crm-types';
import { LEAD_STATUS_STYLES } from './crm-types';

interface LeadDetailsDialogProps {
  lead: Lead | LeadListItem | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailsDialog({ lead, open, onClose }: LeadDetailsDialogProps) {
  if (!open || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Lead Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Lead Number</p>
            <p className="text-sm font-medium">{lead.leadNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEAD_STATUS_STYLES[lead.status]}`}>
              {lead.status.charAt(0) + lead.status.slice(1).toLowerCase()}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Name</p>
            <p className="text-sm font-medium">{lead.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Company</p>
            <p className="text-sm">{lead.company ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <p className="text-sm">{lead.email ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Phone</p>
            <p className="text-sm">{lead.phone ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Source</p>
            <p className="text-sm">{lead.source ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Estimated Value</p>
            <p className="text-sm font-medium">{formatCurrency(Number(lead.estimatedValue))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
            <p className="text-sm">{lead.assignedTo?.name ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <p className="text-sm">{formatDate(lead.createdAt)}</p>
          </div>
          {lead.notes && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
          {'convertedToCustomer' in lead && lead.convertedToCustomer && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Converted To Customer</p>
              <p className="text-sm font-medium text-primary">{lead.convertedToCustomer.name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
