'use client';

import { X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Account } from './accounting-types';

const typeColors: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LIABILITY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EQUITY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  REVENUE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  EXPENSE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface AccountDetailsDialogProps {
  account: Account | null;
  open: boolean;
  onClose: () => void;
}

export function AccountDetailsDialog({ account, open, onClose }: AccountDetailsDialogProps) {
  if (!open || !account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Account Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Code</p>
            <p className="text-sm font-mono font-medium">{account.code}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Type</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[account.type] ?? ''}`}>
              {account.type.charAt(0) + account.type.slice(1).toLowerCase()}
            </span>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Name</p>
            <p className="text-sm font-medium">{account.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Parent Account</p>
            <p className="text-sm">{account.parent ? `${account.parent.code} - ${account.parent.name}` : '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-sm">{account.isActive ? 'Yes' : 'No'}</p>
          </div>
          {account.description && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{account.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created At</p>
            <p className="text-sm">{formatDate(account.createdAt)}</p>
          </div>
          {account.childAccounts && account.childAccounts.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-2">Child Accounts</p>
              <div className="space-y-1">
                {account.childAccounts.map((child) => (
                  <div key={child.id} className="text-sm flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{child.code}</span>
                    <span>{child.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${typeColors[child.type] ?? ''}`}>
                      {child.type.charAt(0) + child.type.slice(1).toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
