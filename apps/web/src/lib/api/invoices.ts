import type { Invoice, InvoiceListResponse } from '@/components/invoices/invoices-types';

import { api } from './client';
import { API_ROUTES } from './routes';

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  salesOrderId?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getInvoices(params?: InvoiceListParams, signal?: AbortSignal): Promise<InvoiceListResponse> {
  const response = await api.get(API_ROUTES.INVOICES.ROOT, { params, signal });
  return response.data;
}

export async function getInvoice(id: string, signal?: AbortSignal): Promise<Invoice> {
  const response = await api.get(`${API_ROUTES.INVOICES.ROOT}/${id}`, { signal });
  return response.data;
}

export async function createInvoiceFromOrder(salesOrderId: string): Promise<Invoice> {
  const response = await api.post(API_ROUTES.INVOICES.FROM_ORDER(salesOrderId));
  return response.data;
}

export async function updateInvoice(
  id: string,
  data: {
    customerId?: string;
    notes?: string;
    issueDate?: string;
    dueDate?: string;
  },
): Promise<Invoice> {
  const response = await api.patch(`${API_ROUTES.INVOICES.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteInvoice(id: string): Promise<{ id: string; message: string }> {
  const response = await api.delete(`${API_ROUTES.INVOICES.ROOT}/${id}`);
  return response.data;
}
