'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck } from 'lucide-react';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { ACCOUNTING_JOURNAL_READ } from '@/lib/permissions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate, formatCurrency } from '@/lib/utils';
import { getGeneralLedger, getAccounts } from '@/lib/api';

export default function LedgerPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const canRead = isLoaded && hasPermission(ACCOUNTING_JOURNAL_READ);
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => getAccounts({ limit: 200 }),
    enabled: canRead,
  });

  const ledgerQuery = useQuery({
    queryKey: ['ledger', { accountId, dateFrom, dateTo }],
    queryFn: () => getGeneralLedger({ accountId: accountId || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    enabled: canRead,
  });

  if (!canRead) {
    return <ForbiddenState title="Access restricted" description="You don't have permission to view ledger. Contact your organization administrator." />;
  }

  if (accountsQuery.isLoading) return <DashboardSkeleton />;
  if (accountsQuery.isError) return <DashboardError message={accountsQuery.error instanceof Error ? accountsQuery.error.message : undefined} onRetry={() => accountsQuery.refetch()} />;

  const accounts: Array<{ id: string; code: string; name: string }> = accountsQuery.data?.data ?? [];
  const ledgerData: Array<{ account: { id: string; code: string; name: string; type: string }; openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number; entries: Array<{ date: string; entryNumber: string; description: string; lineDescription: string | null; debit: number; credit: number; runningBalance: number }> }> = ledgerQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General Ledger</h1>
        <p className="text-sm text-muted-foreground mt-1">View account activity with running balances</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <Label htmlFor="ledger-account">Account</Label>
          <select id="ledger-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">All Accounts</option>
              {accounts.map((a: { id: string; code: string; name: string }) => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ledger-from">From Date</Label>
          <Input id="ledger-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label htmlFor="ledger-to">To Date</Label>
          <Input id="ledger-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {ledgerQuery.isLoading ? (
        <DashboardSkeleton />
      ) : ledgerData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4"><BookOpenCheck className="h-8 w-8 text-muted-foreground" /></div>
          <h3 className="text-lg font-semibold mb-2">No ledger data</h3>
          <p className="text-sm text-muted-foreground max-w-sm">No posted journal entries found for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {ledgerData.map((entry: { account: { id: string; code: string; name: string; type: string }; openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number; entries: Array<{ date: string; entryNumber: string; description: string; lineDescription: string | null; debit: number; credit: number; runningBalance: number }> }) => (
            <div key={entry.account.id} className="rounded-lg border">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-mono font-medium">{entry.account.code}</span>
                    <span className="text-sm ml-2">{entry.account.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 capitalize">({entry.account.type.toLowerCase()})</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Closing Balance: <span className="font-mono font-medium text-foreground">{formatCurrency(entry.closingBalance)}</span>
                  </div>
                </div>
              </div>
              {entry.entries.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No transactions</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Entry #</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Description</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">Debit</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">Credit</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.entries.map((txn: { date: string; entryNumber: string; description: string; lineDescription: string | null; debit: number; credit: number; runningBalance: number }, i: number) => (
                        <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="p-3 text-sm text-muted-foreground">{formatDate(txn.date)}</td>
                          <td className="p-3 text-sm font-mono">{txn.entryNumber}</td>
                          <td className="p-3 text-sm">{txn.description}{txn.lineDescription ? ` - ${txn.lineDescription}` : ''}</td>
                          <td className="p-3 text-sm text-right font-mono">{txn.debit > 0 ? formatCurrency(txn.debit) : ''}</td>
                          <td className="p-3 text-sm text-right font-mono">{txn.credit > 0 ? formatCurrency(txn.credit) : ''}</td>
                          <td className="p-3 text-sm text-right font-mono font-medium">{formatCurrency(txn.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={3} className="p-3 text-sm font-medium">Total</td>
                        <td className="p-3 text-sm font-medium text-right font-mono">{formatCurrency(entry.totalDebit)}</td>
                        <td className="p-3 text-sm font-medium text-right font-mono">{formatCurrency(entry.totalCredit)}</td>
                        <td className="p-3 text-sm font-medium text-right font-mono">{formatCurrency(entry.closingBalance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
