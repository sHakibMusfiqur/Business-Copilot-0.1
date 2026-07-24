'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { formatCurrency } from '@/lib/utils';
import { getTrialBalance } from '@/lib/api';

export default function TrialBalancePage() {
  const query = useQuery({
    queryKey: ['trial-balance'],
    queryFn: () => getTrialBalance(),
  });

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError) return <DashboardError message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;

  const data = query.data?.data ?? [];
  const summary = query.data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trial Balance</h1>
        <p className="text-sm text-muted-foreground mt-1">Verify that total debits equal total credits</p>
      </div>

      <div className={`rounded-lg p-4 flex items-center gap-3 ${summary?.isBalanced ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
        {summary?.isBalanced ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        <div>
          <p className="text-sm font-medium">{summary?.isBalanced ? 'Trial balance is balanced' : 'Trial balance is NOT balanced!'}</p>
          <p className="text-xs opacity-80">
            Total Debits: {formatCurrency(summary?.totalDebit ?? 0)} | Total Credits: {formatCurrency(summary?.totalCredit ?? 0)}
            {!summary?.isBalanced && ` | Difference: ${formatCurrency(Math.abs((summary?.totalDebit ?? 0) - (summary?.totalCredit ?? 0)))}`}
          </p>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Account</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Debit</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Credit</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: { account: { id: string; code: string; name: string; type: string }; totalDebit: number; totalCredit: number; balance: number; balanceType: string }) => (
                <tr key={row.account.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-4 font-mono text-sm">{row.account.code}</td>
                  <td className="p-4 text-sm">{row.account.name}</td>
                  <td className="p-4">
                    <span className={`text-xs capitalize ${
                      row.account.type === 'ASSET' || row.account.type === 'EXPENSE' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {row.account.type.toLowerCase()}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-right font-mono">{row.totalDebit > 0 ? formatCurrency(row.totalDebit) : ''}</td>
                  <td className="p-4 text-sm text-right font-mono">{row.totalCredit > 0 ? formatCurrency(row.totalCredit) : ''}</td>
                  <td className="p-4 text-sm text-right font-mono font-medium">
                    <span className={row.balanceType === 'debit' ? 'text-amber-600' : 'text-blue-600'}>
                      {row.balance > 0 ? `${row.balanceType === 'debit' ? '' : ''}${formatCurrency(row.balance)}` : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td colSpan={3} className="p-4 text-sm">Total</td>
                <td className="p-4 text-sm text-right font-mono">{formatCurrency(summary?.totalDebit ?? 0)}</td>
                <td className="p-4 text-sm text-right font-mono">{formatCurrency(summary?.totalCredit ?? 0)}</td>
                <td className="p-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
