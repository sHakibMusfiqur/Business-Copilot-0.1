import { api } from './client';
import { API_ROUTES } from './routes';

export interface AccountListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getAccountSummary(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.SUMMARY, { signal });
  return response.data;
}

export async function getAccounts(params?: AccountListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.ACCOUNTS, { params, signal });
  return response.data;
}

export async function createAccount(data: {
  code: string;
  name: string;
  type: string;
  parentId?: string;
  description?: string;
}) {
  const response = await api.post(API_ROUTES.ACCOUNTING.ACCOUNTS, data);
  return response.data;
}

export async function updateAccount(
  id: string,
  data: {
    code?: string;
    name?: string;
    type?: string;
    parentId?: string;
    description?: string;
    isActive?: boolean;
  },
) {
  const response = await api.patch(`${API_ROUTES.ACCOUNTING.ACCOUNTS}/${id}`, data);
  return response.data;
}

export async function deleteAccount(id: string) {
  const response = await api.delete(`${API_ROUTES.ACCOUNTING.ACCOUNTS}/${id}`);
  return response.data;
}

export interface JournalEntryListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getJournalEntries(params?: JournalEntryListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.JOURNAL, { params, signal });
  return response.data;
}

export async function createJournalEntry(data: {
  description: string;
  referenceId?: string;
  referenceType?: string;
  lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
}) {
  const response = await api.post(API_ROUTES.ACCOUNTING.JOURNAL, data);
  return response.data;
}

export async function postJournalEntry(id: string) {
  const response = await api.post(`${API_ROUTES.ACCOUNTING.JOURNAL}/${id}/post`);
  return response.data;
}

export async function deleteJournalEntry(id: string) {
  const response = await api.delete(`${API_ROUTES.ACCOUNTING.JOURNAL}/${id}`);
  return response.data;
}

export async function getReceivables(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.RECEIVABLES, { params, signal });
  return response.data;
}

export async function getPayables(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.PAYABLES, { params, signal });
  return response.data;
}

export async function getPayments(params?: {
  page?: number;
  limit?: number;
  type?: string;
}, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.PAYMENTS, { params, signal });
  return response.data;
}

export async function createPayment(data: {
  type: 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT';
  customerId?: string;
  supplierId?: string;
  amount: number;
  reference?: string;
  notes?: string;
}) {
  const response = await api.post(API_ROUTES.ACCOUNTING.PAYMENTS, data);
  return response.data;
}

export async function getGeneralLedger(params?: {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
}, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.LEDGER, { params, signal });
  return response.data;
}

export async function getTrialBalance(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ACCOUNTING.TRIAL_BALANCE, { signal });
  return response.data;
}
