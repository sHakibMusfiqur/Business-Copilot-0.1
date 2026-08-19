'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  FileText,
  ArrowRight,
  DollarSign,
  Wallet,
} from 'lucide-react';

import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { formatDate, formatCurrency } from '@/lib/utils';
import { getAccountSummary, getJournalEntries, getPayments } from '@/lib/api';
import type { AccountSummary, JournalEntry, Payment } from '@/components/accounting/accounting-types';

const AccountingCharts = dynamic(
  () => import('@/components/accounting/accounting-charts').then((m) => m.AccountingCharts),
  { ssr: false },
);

const quickLinks = [
  { label: 'Chart of Accounts', href: '/accounting/accounts', desc: 'Manage accounts' },
  { label: 'Journal Entries', href: '/accounting/journal', desc: 'Create & post entries' },
  { label: 'General Ledger', href: '/accounting/ledger', desc: 'View account activity' },
  { label: 'Trial Balance', href: '/accounting/trial-balance', desc: 'Verify balances' },
  { label: 'Receivables', href: '/accounting/receivables', desc: 'Customer invoices' },
  { label: 'Payables', href: '/accounting/payables', desc: 'Supplier bills' },
  { label: 'Payments', href: '/accounting/payments', desc: 'Record payments' },
];

export default function AccountingPage() {
  const summaryQuery = useQuery<AccountSummary>({
    queryKey: ['accounting-summary'],
    queryFn: () => getAccountSummary(),
  });

  const recentEntriesQuery = useQuery({
    queryKey: ['journal-entries', { page: 1, limit: 5 }],
    queryFn: () => getJournalEntries({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
  });

  const recentPaymentsQuery = useQuery({
    queryKey: ['payments', { page: 1, limit: 5 }],
    queryFn: () => getPayments({ page: 1, limit: 5 }),
  });

  if (summaryQuery.isLoading) return <DashboardSkeleton />;
  if (summaryQuery.isError) return <DashboardError message={summaryQuery.error instanceof Error ? summaryQuery.error.message : undefined} onRetry={() => summaryQuery.refetch()} />;

  const s = summaryQuery.data as AccountSummary;
  const recentEntries: JournalEntry[] = recentEntriesQuery.data?.data ?? [];
  const recentPayments: Payment[] = recentPaymentsQuery.data?.data ?? [];

  const series = s.monthlySeries;
  const monthlyData = series && series.labels.length > 0
    ? series.labels.map((month, i) => ({
        month,
        revenue: series.revenue[i] ?? 0,
        expense: series.expenses[i] ?? 0,
      }))
    : [{ month: 'YTD', revenue: s.totalRevenue, expense: s.totalExpenses }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounting & Finance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage chart of accounts, journal entries, receivables, payables, and payments
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-blue-500/10 p-2.5"><BookOpen className="h-5 w-5 text-blue-500" /></div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Total Accounts</p>
            <p className="text-2xl font-semibold mt-1">{s.totalAccounts}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s.totalAccountsByType.ASSET ?? 0} Asset / {s.totalAccountsByType.LIABILITY ?? 0} Liability
            </p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-green-500/10 p-2.5"><TrendingUp className="h-5 w-5 text-green-500" /></div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(s.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Expenses: {formatCurrency(s.totalExpenses)}
            </p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-emerald-500/10 p-2.5"><DollarSign className="h-5 w-5 text-emerald-500" /></div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Receivables</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(s.outstandingReceivables)}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.totalReceivables} invoices</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-orange-500/10 p-2.5"><TrendingDown className="h-5 w-5 text-orange-500" /></div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Payables</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(s.outstandingPayables)}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.totalPayables} bills</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-purple-500/10 p-2.5"><Wallet className="h-5 w-5 text-purple-500" /></div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Cash Balance</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(s.cashBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.postedJournalEntries} posted entries</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AccountingCharts monthlyData={monthlyData} />
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Quick Links</h3>
            <div className="space-y-1">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                  <span>{link.label}</span>
                  <span className="text-xs text-muted-foreground">{link.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Recent Journal Entries</h3>
            <Link href="/accounting/journal" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentEntries.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No journal entries yet.</p>
          ) : (
            <div className="divide-y">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{entry.entryNumber}</p>
                    <p className="text-xs text-muted-foreground">{entry.description}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    entry.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {entry.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" /> Recent Payments</h3>
            <Link href="/accounting/payments" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="divide-y">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm">
                      {payment.customer?.name ?? payment.supplier?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.paymentDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium">{formatCurrency(payment.amount)}</p>
                    <p className={`text-xs ${payment.type === 'CUSTOMER_PAYMENT' ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {payment.type === 'CUSTOMER_PAYMENT' ? 'Received' : 'Sent'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
