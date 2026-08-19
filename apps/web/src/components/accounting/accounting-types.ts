import type { Meta } from '@/lib/types';

export interface AccountSummary {  totalAccounts: number;
  totalAccountsByType: Record<string, number>;
  totalReceivables: number;
  totalReceivablesAmount: number;
  outstandingReceivables: number;
  totalPayables: number;
  totalPayablesAmount: number;
  outstandingPayables: number;
  postedJournalEntries: number;
  totalRevenue: number;
  totalExpenses: number;
  cashBalance: number;
  monthlySeries?: {
    labels: string[];
    revenue: number[];
    expenses: number[];
  };
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  parent?: { id: string; code: string; name: string } | null;
  childAccounts?: Array<{ id: string; code: string; name: string; type: string }>;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: 'DRAFT' | 'POSTED';
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  lines: Array<{
    id: string;
    debit: number;
    credit: number;
    description: string | null;
    account: { id: string; code: string; name: string };
  }>;
  totalDebit?: number;
  totalCredit?: number;
}

export interface Receivable {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  balance: number;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
}

export interface Payable {
  id: string;
  billNumber: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  balance: number;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string } | null;
}

export interface Payment {
  id: string;
  type: 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT';
  amount: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
}

export type { Meta };
