'use client';

import { X } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { JournalEntry } from './accounting-types';

const statusStyle: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  POSTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

interface JournalDetailsDialogProps {
  entry: JournalEntry | null;
  open: boolean;
  onClose: () => void;
}

export function JournalDetailsDialog({ entry, open, onClose }: JournalDetailsDialogProps) {
  if (!open || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Journal Entry Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Entry Number</p>
            <p className="text-sm font-medium">{entry.entryNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Date</p>
            <p className="text-sm">{formatDate(entry.date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[entry.status] ?? ''}`}>
              {entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}
            </span>
          </div>
          <div className="col-span-3">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{entry.description}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created By</p>
            <p className="text-sm">{entry.createdBy?.name ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created At</p>
            <p className="text-sm">{formatDate(entry.createdAt)}</p>
          </div>
          {entry.referenceType && entry.referenceId && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Reference</p>
              <p className="text-sm">{entry.referenceType}: {entry.referenceId}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Account</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Debit</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Credit</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => (
                <tr key={line.id} className="border-b last:border-b-0">
                  <td className="p-3 text-sm">{line.account.code} - {line.account.name}</td>
                  <td className="p-3 text-sm text-right font-mono">{Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : ''}</td>
                  <td className="p-3 text-sm text-right font-mono">{Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : ''}</td>
                  <td className="p-3 text-sm text-muted-foreground">{line.description ?? '\u2014'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td className="p-3 text-sm font-medium">Total</td>
                <td className="p-3 text-sm font-medium text-right font-mono">{formatCurrency(entry.totalDebit ?? 0)}</td>
                <td className="p-3 text-sm font-medium text-right font-mono">{formatCurrency(entry.totalCredit ?? 0)}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
