import type { SaleListResponse } from '@/components/sales/sales-types';

import { api } from './client';
import { API_ROUTES } from './routes';

export interface SalesListParams {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getSales(params?: SalesListParams, signal?: AbortSignal): Promise<SaleListResponse> {
  const response = await api.get(API_ROUTES.SALES.ROOT, { params, signal });
  return response.data;
}

export async function createSale(
  data: {
    customerId: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      tax?: number;
    }>;
  },
): Promise<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }> {
  const response = await api.post(API_ROUTES.SALES.ROOT, data);
  return response.data;
}

export async function updateSale(
  id: string,
  data: {
    customerId?: string;
    notes?: string;
    items?: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      tax?: number;
    }>;
  },
): Promise<{ id: string; message: string } | { id: string; orderNumber: string; status: string; total: number; updatedAt: string }> {
  const response = await api.patch(`${API_ROUTES.SALES.ROOT}/${id}`, data);
  return response.data;
}

export async function confirmSale(id: string): Promise<{ id: string; orderNumber: string; status: string }> {
  const response = await api.post(`${API_ROUTES.SALES.ROOT}/${id}/confirm`);
  return response.data;
}

export async function deliverSale(id: string, notes?: string): Promise<{ id: string; orderNumber: string; status: string; updatedAt: string }> {
  const response = await api.post(`${API_ROUTES.SALES.ROOT}/${id}/deliver`, { notes });
  return response.data;
}

export async function deleteSale(id: string): Promise<{ message: string }> {
  const response = await api.delete(`${API_ROUTES.SALES.ROOT}/${id}`);
  return response.data;
}
